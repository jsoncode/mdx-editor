import { useEffect, useState } from "react";
import {
  findNext,
  findPrevious,
  getSearchQuery,
  replaceAll,
  replaceNext,
  SearchQuery,
  setSearchQuery,
} from "@codemirror/search";
import { useEditorStore } from "../stores/editorStore";
import { useUiStore } from "../stores/uiStore";

export function SearchPanel() {
  const view = useEditorStore((s) => s.view);
  const setSearchOpen = useUiStore((s) => s.setSearchOpen);
  const [searchText, setSearchText] = useState("");
  const [replaceText, setReplaceText] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [showReplace, setShowReplace] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!view) return;
    const query = getSearchQuery(view.state);
    setSearchText(query.search);
    setReplaceText(query.replace);
    setCaseSensitive(query.caseSensitive);
    setWholeWord(query.wholeWord);
    setUseRegex(query.regexp);
  }, [view]);

  const applyQuery = (patch: Partial<SearchQuery>) => {
    if (!view) return null;
    const current = getSearchQuery(view.state);
    const next = new SearchQuery({ ...current, ...patch });
    view.dispatch({ effects: setSearchQuery.of(next) });
    return next;
  };

  const handleSearchChange = (value: string) => {
    setSearchText(value);
    applyQuery({ search: value });
    setMessage("");
  };

  const handleReplaceChange = (value: string) => {
    setReplaceText(value);
    applyQuery({ replace: value });
  };

  const runFind = (direction: "next" | "prev") => {
    if (!view) return;
    applyQuery({
      search: searchText,
      replace: replaceText,
      caseSensitive,
      wholeWord,
      regexp: useRegex,
    });
    const ok = direction === "next" ? findNext(view) : findPrevious(view);
    setMessage(ok ? "" : "未找到匹配内容");
  };

  const runReplace = () => {
    if (!view) return;
    applyQuery({
      search: searchText,
      replace: replaceText,
      caseSensitive,
      wholeWord,
      regexp: useRegex,
    });
    const ok = replaceNext(view);
    setMessage(ok ? "已替换 1 处" : "未找到可替换内容");
  };

  const runReplaceAll = () => {
    if (!view) return;
    applyQuery({
      search: searchText,
      replace: replaceText,
      caseSensitive,
      wholeWord,
      regexp: useRegex,
    });
    const ok = replaceAll(view);
    setMessage(ok ? "已全部替换" : "未找到可替换内容");
  };

  return (
    <div className="search-panel">
      <div className="search-panel-header">
        <span className="search-panel-title">查找与替换</span>
        <button type="button" className="search-close" onClick={() => setSearchOpen(false)} title="关闭 (Esc)">
          ×
        </button>
      </div>
      <div className="search-panel-row">
        <label className="search-field">
          <span>查找</span>
          <input
            type="text"
            value={searchText}
            placeholder="输入要查找的内容..."
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") runFind(e.shiftKey ? "prev" : "next");
            }}
          />
        </label>
        <div className="search-actions">
          <button type="button" onClick={() => runFind("prev")}>
            上一个
          </button>
          <button type="button" onClick={() => runFind("next")}>
            下一个
          </button>
          <button type="button" className="secondary" onClick={() => setShowReplace((v) => !v)}>
            {showReplace ? "隐藏替换" : "替换"}
          </button>
        </div>
      </div>

      {showReplace && (
        <div className="search-panel-row">
          <label className="search-field">
            <span>替换</span>
            <input
              type="text"
              value={replaceText}
              placeholder="替换为..."
              onChange={(e) => handleReplaceChange(e.target.value)}
            />
          </label>
          <div className="search-actions">
            <button type="button" onClick={runReplace}>
              替换
            </button>
            <button type="button" onClick={runReplaceAll}>
              全部替换
            </button>
          </div>
        </div>
      )}

      <div className="search-panel-options">
        <label>
          <input
            type="checkbox"
            checked={caseSensitive}
            onChange={(e) => {
              setCaseSensitive(e.target.checked);
              applyQuery({ caseSensitive: e.target.checked });
            }}
          />
          区分大小写
        </label>
        <label>
          <input
            type="checkbox"
            checked={wholeWord}
            onChange={(e) => {
              setWholeWord(e.target.checked);
              applyQuery({ wholeWord: e.target.checked });
            }}
          />
          全字匹配
        </label>
        <label>
          <input
            type="checkbox"
            checked={useRegex}
            onChange={(e) => {
              setUseRegex(e.target.checked);
              applyQuery({ regexp: e.target.checked });
            }}
          />
          正则表达式
        </label>
        {message && <span className="search-message">{message}</span>}
      </div>
    </div>
  );
}
