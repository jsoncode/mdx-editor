use std::fs::File;
use std::io::Read;
use std::path::Path;

use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Nonce,
};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;

use crate::error::{AppError, AppResult};

const MAGIC: &[u8; 5] = b"EMDX1";
const FORMAT_VERSION: u8 = 1;
const SALT_LEN: usize = 16;
const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;
const PBKDF2_ITERATIONS: u32 = 120_000;
const HEADER_LEN: usize = MAGIC.len() + 1 + SALT_LEN + NONCE_LEN;

pub fn is_encrypted_mdx(path: &Path) -> AppResult<bool> {
    let mut file = File::open(path).map_err(AppError::Io)?;
    let mut magic = [0u8; 5];
    let read = file.read(&mut magic).map_err(AppError::Io)?;
    Ok(read >= MAGIC.len() && magic == *MAGIC)
}

pub fn is_encrypted_bytes(data: &[u8]) -> bool {
    data.len() >= MAGIC.len() && data.starts_with(MAGIC)
}

pub fn encrypt_bytes(plaintext: &[u8], password: &str) -> AppResult<Vec<u8>> {
    validate_password(password)?;

    let mut salt = [0u8; SALT_LEN];
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce_bytes);

    let mut key = [0u8; KEY_LEN];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key);

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|error| AppError::Other(format!("加密初始化失败: {error}")))?;
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| AppError::Other("加密失败".to_string()))?;

    let mut output =
        Vec::with_capacity(HEADER_LEN + ciphertext.len());
    output.extend_from_slice(MAGIC);
    output.push(FORMAT_VERSION);
    output.extend_from_slice(&salt);
    output.extend_from_slice(&nonce_bytes);
    output.extend_from_slice(&ciphertext);
    Ok(output)
}

pub fn decrypt_bytes(data: &[u8], password: &str) -> AppResult<Vec<u8>> {
    validate_password(password)?;

    if !is_encrypted_bytes(data) {
        return Err(AppError::InvalidMdx("不是有效的加密 MDX 文件".to_string()));
    }
    if data.len() < HEADER_LEN {
        return Err(AppError::InvalidMdx("加密 MDX 文件不完整".to_string()));
    }
    if data[MAGIC.len()] != FORMAT_VERSION {
        return Err(AppError::InvalidMdx("不支持的加密 MDX 版本".to_string()));
    }

    let salt_start = MAGIC.len() + 1;
    let nonce_start = salt_start + SALT_LEN;
    let cipher_start = nonce_start + NONCE_LEN;

    let salt = &data[salt_start..nonce_start];
    let nonce_bytes = &data[nonce_start..cipher_start];
    let ciphertext = &data[cipher_start..];

    let mut key = [0u8; KEY_LEN];
    pbkdf2_hmac::<Sha256>(password.as_bytes(), salt, PBKDF2_ITERATIONS, &mut key);

    let cipher = Aes256Gcm::new_from_slice(&key)
        .map_err(|error| AppError::Other(format!("解密初始化失败: {error}")))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| AppError::Other("密码错误或文件已损坏".to_string()))
}

fn validate_password(password: &str) -> AppResult<()> {
    if password.trim().is_empty() {
        return Err(AppError::Other("密码不能为空".to_string()));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_encrypt_decrypt() {
        let plain = b"PK\x03\x04fake-zip-content";
        let encrypted = encrypt_bytes(plain, "secret-pass").unwrap();
        assert!(is_encrypted_bytes(&encrypted));
        let decrypted = decrypt_bytes(&encrypted, "secret-pass").unwrap();
        assert_eq!(decrypted, plain);
    }

    #[test]
    fn wrong_password_fails() {
        let encrypted = encrypt_bytes(b"hello", "right").unwrap();
        assert!(decrypt_bytes(&encrypted, "wrong").is_err());
    }
}
