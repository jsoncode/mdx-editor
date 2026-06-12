use std::path::Path;

use git2::{
    build::CheckoutBuilder, Cred, ErrorCode, FetchOptions, IndexAddOption, PushOptions,
    RemoteCallbacks, Repository, Signature, StatusOptions,
};

use crate::error::{AppError, AppResult};
use crate::git_sync::config::{GitPullResult, GitSyncConfig, GitSyncStatus};

fn auth_callbacks(token: &str) -> RemoteCallbacks<'static> {
    let token = token.to_string();
    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(move |_url, username_from_url, _allowed| {
        if token.is_empty() {
            return Err(git2::Error::from_str("Git token is empty"));
        }
        Cred::userpass_plaintext(username_from_url.unwrap_or("git"), &token)
    });
    callbacks
}

fn ensure_gitignore(vault_path: &Path) -> AppResult<()> {
    let gitignore = vault_path.join(".gitignore");
    if gitignore.exists() {
        return Ok(());
    }
    let content = r#".DS_Store
Thumbs.db
*.tmp
"#;
    std::fs::write(gitignore, content)?;
    Ok(())
}

pub fn open_or_init(vault_path: &Path) -> AppResult<Repository> {
    if vault_path.join(".git").exists() {
        Repository::open(vault_path).map_err(AppError::Git)
    } else {
        ensure_gitignore(vault_path)?;
        Repository::init(vault_path).map_err(AppError::Git)
    }
}

fn configure_remote(repo: &Repository, config: &GitSyncConfig) -> AppResult<()> {
    let url = config.remote_url.trim();
    if url.is_empty() {
        return Err(AppError::Other("Git remote URL is empty".to_string()));
    }

    if repo.find_remote("origin").is_ok() {
        repo.remote_set_url("origin", url).map_err(AppError::Git)?;
    } else {
        repo.remote("origin", url).map_err(AppError::Git)?;
    }
    Ok(())
}

fn ensure_local_branch(repo: &Repository, branch: &str) -> AppResult<()> {
    let head = repo.head().ok();
    if head.is_some() {
        return Ok(());
    }

    let signature = Signature::now("MDX Editor", "mdx-editor@local").map_err(AppError::Git)?;
    let tree_id = repo.index()?.write_tree().map_err(AppError::Git)?;
    let tree = repo.find_tree(tree_id).map_err(AppError::Git)?;
    repo.commit(
        Some(&format!("refs/heads/{branch}")),
        &signature,
        &signature,
        "Initial commit",
        &tree,
        &[],
    )
    .map_err(AppError::Git)?;
    repo.set_head(&format!("refs/heads/{branch}"))
        .map_err(AppError::Git)?;
    Ok(())
}

fn fetch_remote(repo: &Repository, config: &GitSyncConfig) -> AppResult<()> {
    let branch = config.effective_branch();
    let mut remote = repo.find_remote("origin").map_err(AppError::Git)?;
    let callbacks = auth_callbacks(&config.token);
    let mut fetch_options = FetchOptions::new();
    fetch_options.remote_callbacks(callbacks);
    let refspec = format!("+refs/heads/{branch}:refs/remotes/origin/{branch}");
    remote
        .fetch(&[refspec.as_str()], Some(&mut fetch_options), None)
        .map_err(AppError::Git)?;
    Ok(())
}

fn fast_forward_pull(repo: &Repository, branch: &str) -> AppResult<GitPullResult> {
    let local_ref = format!("refs/heads/{branch}");
    let remote_ref = format!("refs/remotes/origin/{branch}");

    let local_commit = repo
        .find_reference(&local_ref)
        .ok()
        .and_then(|r| r.peel_to_commit().ok());
    let remote_commit = repo
        .find_reference(&remote_ref)
        .ok()
        .and_then(|r| r.peel_to_commit().ok());

    let Some(remote_commit) = remote_commit else {
        return Ok(GitPullResult {
            updated: false,
            message: "远程分支不存在，跳过拉取".to_string(),
            has_conflicts: false,
        });
    };

    if local_commit
        .as_ref()
        .map(|c| c.id() == remote_commit.id())
        .unwrap_or(false)
    {
        return Ok(GitPullResult {
            updated: false,
            message: "已是最新".to_string(),
            has_conflicts: false,
        });
    }

    let annotated = repo
        .find_annotated_commit(remote_commit.id())
        .map_err(AppError::Git)?;
    let (analysis, _) = repo
        .merge_analysis(&[&annotated])
        .map_err(AppError::Git)?;

    if analysis.is_up_to_date() {
        return Ok(GitPullResult {
            updated: false,
            message: "已是最新".to_string(),
            has_conflicts: false,
        });
    }

    if analysis.is_fast_forward() {
        let mut reference = repo.find_reference(&local_ref).map_err(AppError::Git)?;
        reference
            .set_target(remote_commit.id(), "Fast-forward")
            .map_err(AppError::Git)?;
        repo.set_head(&local_ref).map_err(AppError::Git)?;
        let mut checkout = CheckoutBuilder::new();
        checkout.force();
        repo.checkout_head(Some(&mut checkout))
            .map_err(AppError::Git)?;
        return Ok(GitPullResult {
            updated: true,
            message: "已从远程快进更新".to_string(),
            has_conflicts: false,
        });
    }

    Ok(GitPullResult {
        updated: false,
        message: "本地与远程存在分叉，请手动解决冲突后再同步".to_string(),
        has_conflicts: true,
    })
}

pub fn pull(vault_path: &Path, config: &GitSyncConfig) -> AppResult<GitPullResult> {
    if !config.enabled {
        return Ok(GitPullResult {
            updated: false,
            message: "Git 同步未启用".to_string(),
            has_conflicts: false,
        });
    }

    let branch = config.effective_branch();
    let repo = open_or_init(vault_path)?;
    configure_remote(&repo, config)?;
    ensure_local_branch(&repo, &branch)?;

    match fetch_remote(&repo, config) {
        Ok(()) => fast_forward_pull(&repo, &branch),
        Err(AppError::Git(err))
            if err.code() == ErrorCode::Auth
                || err.class() == git2::ErrorClass::Http
                || err.class() == git2::ErrorClass::Net =>
        {
            Err(AppError::Other(format!("拉取失败: {err}")))
        }
        Err(AppError::Git(err)) if err.code() == ErrorCode::NotFound => Ok(GitPullResult {
            updated: false,
            message: "远程仓库为空或分支不存在，跳过拉取".to_string(),
            has_conflicts: false,
        }),
        Err(err) => Err(err),
    }
}

fn stage_all(repo: &Repository) -> AppResult<bool> {
    let mut index = repo.index().map_err(AppError::Git)?;
    index
        .add_all(["*"].iter(), IndexAddOption::DEFAULT, None)
        .map_err(AppError::Git)?;
    index.write().map_err(AppError::Git)?;

    let tree_id = index.write_tree().map_err(AppError::Git)?;
    let tree = repo.find_tree(tree_id).map_err(AppError::Git)?;
    let head = repo.head().ok().and_then(|h| h.peel_to_commit().ok());
    let old_tree = head
        .as_ref()
        .map(|commit| commit.tree())
        .transpose()
        .map_err(AppError::Git)?;

    let diff = repo
        .diff_tree_to_tree(old_tree.as_ref(), Some(&tree), None)
        .map_err(AppError::Git)?;
    Ok(!diff.deltas().next().is_none())
}

fn commit_all(repo: &Repository, config: &GitSyncConfig, message: &str) -> AppResult<bool> {
    if !stage_all(repo)? {
        return Ok(false);
    }

    let name = config.author_name.trim();
    let email = config.author_email.trim();
    let (name, email) = if name.is_empty() || email.is_empty() {
        ("MDX Editor", "mdx-editor@local")
    } else {
        (name, email)
    };

    let signature = Signature::now(name, email).map_err(AppError::Git)?;

    let tree_id = repo.index()?.write_tree().map_err(AppError::Git)?;
    let tree = repo.find_tree(tree_id).map_err(AppError::Git)?;
    let parent = repo
        .head()
        .ok()
        .and_then(|h| h.peel_to_commit().ok());

    if let Some(parent) = parent {
        repo.commit(
            Some("HEAD"),
            &signature,
            &signature,
            message,
            &tree,
            &[&parent],
        )
        .map_err(AppError::Git)?;
    } else {
        let branch = config.effective_branch();
        repo.commit(
            Some(&format!("refs/heads/{branch}")),
            &signature,
            &signature,
            message,
            &tree,
            &[],
        )
        .map_err(AppError::Git)?;
        repo.set_head(&format!("refs/heads/{branch}"))
            .map_err(AppError::Git)?;
    }

    Ok(true)
}

fn push_remote(repo: &Repository, config: &GitSyncConfig) -> AppResult<()> {
    let branch = config.effective_branch();
    let mut remote = repo.find_remote("origin").map_err(AppError::Git)?;
    let refspec = format!("refs/heads/{branch}:refs/heads/{branch}");
    let callbacks = auth_callbacks(&config.token);
    let mut push_options = PushOptions::new();
    push_options.remote_callbacks(callbacks);
    remote
        .push(&[refspec.as_str()], Some(&mut push_options))
        .map_err(AppError::Git)?;
    Ok(())
}

fn local_ahead_of_remote(repo: &Repository, branch: &str) -> AppResult<bool> {
    let local_ref = format!("refs/heads/{branch}");
    let remote_ref = format!("refs/remotes/origin/{branch}");
    let local = repo
        .find_reference(&local_ref)
        .ok()
        .and_then(|r| r.peel_to_commit().ok());
    let remote = repo
        .find_reference(&remote_ref)
        .ok()
        .and_then(|r| r.peel_to_commit().ok());

    match (local, remote) {
        (Some(local), Some(remote)) => {
            if local.id() == remote.id() {
                Ok(false)
            } else {
                Ok(repo
                    .graph_descendant_of(remote.id(), local.id())
                    .unwrap_or(false))
            }
        }
        (Some(_), None) => Ok(true),
        _ => Ok(false),
    }
}

pub fn push_in_process(
    vault_path: &Path,
    config: &GitSyncConfig,
    message: &str,
) -> AppResult<()> {
    if !config.enabled {
        return Ok(());
    }

    let branch = config.effective_branch();
    let repo = open_or_init(vault_path)?;
    configure_remote(&repo, config)?;
    ensure_local_branch(&repo, &branch)?;

    let _ = fetch_remote(&repo, config);
    let pull_result = fast_forward_pull(&repo, &branch)?;
    if pull_result.has_conflicts {
        return Err(AppError::Other(pull_result.message));
    }

    if commit_all(&repo, config, message)? || local_ahead_of_remote(&repo, &branch)? {
        push_remote(&repo, config)?;
    }

    Ok(())
}

pub fn test_connection(vault_path: &Path, config: &GitSyncConfig) -> AppResult<String> {
    let repo = open_or_init(vault_path)?;
    configure_remote(&repo, config)?;
    fetch_remote(&repo, config)?;
    Ok("连接成功，已获取远程更新".to_string())
}

pub fn status(vault_path: &Path, config: &GitSyncConfig) -> AppResult<GitSyncStatus> {
    let branch = config.effective_branch();
    let initialized = vault_path.join(".git").exists();
    if !initialized {
        return Ok(GitSyncStatus {
            initialized: false,
            has_remote: false,
            branch,
            ahead: 0,
            behind: 0,
            dirty: false,
            last_error: None,
        });
    }

    let repo = Repository::open(vault_path).map_err(AppError::Git)?;
    let has_remote = repo.find_remote("origin").is_ok();

    let mut dirty = false;
    let mut status_options = StatusOptions::new();
    status_options.include_untracked(true);
    status_options.recurse_untracked_dirs(true);
    if let Ok(statuses) = repo.statuses(Some(&mut status_options)) {
        dirty = statuses.iter().next().is_some();
    }

    let mut ahead = 0;
    let mut behind = 0;
    if has_remote && config.enabled && !config.token.is_empty() {
        if fetch_remote(&repo, config).is_ok() {
            let local_ref = format!("refs/heads/{branch}");
            let remote_ref = format!("refs/remotes/origin/{branch}");
            let local = repo
                .find_reference(&local_ref)
                .ok()
                .and_then(|r| r.peel_to_commit().ok());
            let remote = repo
                .find_reference(&remote_ref)
                .ok()
                .and_then(|r| r.peel_to_commit().ok());
            if let (Some(local), Some(remote)) = (local, remote) {
                if local.id() != remote.id() {
                    if repo
                        .graph_descendant_of(local.id(), remote.id())
                        .unwrap_or(false)
                    {
                        behind = 1;
                    } else if repo
                        .graph_descendant_of(remote.id(), local.id())
                        .unwrap_or(false)
                    {
                        ahead = 1;
                    } else {
                        ahead = 1;
                        behind = 1;
                    }
                }
            }
        }
    }

    Ok(GitSyncStatus {
        initialized,
        has_remote,
        branch,
        ahead,
        behind,
        dirty,
        last_error: None,
    })
}
