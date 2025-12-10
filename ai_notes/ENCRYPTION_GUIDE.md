# Encryption Guide - LLM Council

## Overview

LLM Council now supports **encrypted conversation storage** to protect sensitive message content at rest. This feature uses symmetric encryption (Fernet/AES-128) and is enabled by default.

## Quick Start

### 1. Generate Encryption Key

Run the key generation script (only needed once):

```bash
python generate_encryption_key.py
```

This will:
- Generate a secure Fernet encryption key
- Add it to your `.env` file as `ENCRYPTION_KEY`
- Enable encryption by setting `ENCRYPTION_ENABLED=true`

### 2. Backup Your Key

**⚠️ CRITICAL: Back up your `.env` file immediately!**

Without the encryption key, you cannot decrypt your conversations. There is no recovery mechanism by design.

```bash
# Example: Copy to secure location
cp .env .env.backup
# Store .env.backup in a secure location (password manager, encrypted backup, etc.)
```

### 3. Start Using the Application

Encryption happens automatically:
- New conversations are encrypted when saved
- Existing conversations are re-encrypted on next save
- No user action required

## What Gets Encrypted

### Encrypted ✓
- All message content (user and assistant messages)
- All stages (Stage 1 responses, Stage 2 rankings, Stage 3 synthesis)
- Stage 1.5 interrogation data (if present)
- Message metadata (label_to_model, aggregate_rankings)

### NOT Encrypted ✗
- Conversation ID
- Conversation title
- Creation timestamp
- Profile ID
- Public/private flag
- Sync status
- Uses BYOK flag

**Rationale:** Metadata must remain unencrypted for:
- Conversation listing (without decrypting entire file)
- Search and filtering
- Performance (no decryption needed for metadata operations)

## File Format

### Encrypted Conversation
```json
{
  "_encryption": {
    "version": "1.0",
    "provider": "fernet"
  },
  "id": "conversation-abc123",
  "profile_id": "default",
  "created_at": "2025-11-26T10:30:00",
  "title": "My Conversation",
  "messages_encrypted": "gAAAAABmX9K8_base64_ciphertext_here...",
  "is_public": false,
  "published_at": null,
  "sync_status": "local",
  "uses_byok": false
}
```

### Legacy Unencrypted (Still Supported)
```json
{
  "id": "conversation-abc123",
  "profile_id": "default",
  "created_at": "2025-11-26T10:30:00",
  "title": "My Conversation",
  "messages": [
    {"role": "user", "content": "Hello"},
    {"role": "assistant", "stage1": [...], "stage2": [...], "stage3": {...}}
  ],
  "is_public": false,
  "published_at": null,
  "sync_status": "local",
  "uses_byok": false
}
```

## Configuration

### Environment Variables (`.env`)

```bash
# Encryption key (base64-encoded Fernet key)
ENCRYPTION_KEY=3aBWsnmIYzBxeWemouQpX4raomF4PfUlGRvT36rIef4=

# Enable/disable encryption (default: true)
ENCRYPTION_ENABLED=true
```

### Disabling Encryption

To disable encryption (not recommended for production):

```bash
# In .env file
ENCRYPTION_ENABLED=false
```

**Warning:** Disabling encryption will:
- Save new conversations as plaintext
- Still be able to read encrypted conversations (if key present)
- NOT decrypt existing conversations automatically

## Backward Compatibility

The encryption system is fully backward compatible:

1. **Legacy files load automatically**: Unencrypted conversations from before encryption was added load without errors
2. **Automatic migration**: Legacy files are re-encrypted on next save (zero-downtime migration)
3. **Detection**: System auto-detects encrypted vs. unencrypted via `_encryption` field
4. **No manual steps**: Just enable encryption and continue using the app

### Migration Path

```
User upgrades to encryption-enabled version
  ↓
Generates encryption key (or uses existing)
  ↓
Starts using application normally
  ↓
When each conversation is loaded:
  - If encrypted: decrypt and use
  - If unencrypted: load as-is
  ↓
When conversation is saved:
  - Encrypt messages automatically
  - Write with _encryption metadata
  ↓
All conversations gradually migrate to encrypted format
```

## Security Considerations

### What This Protects Against
- ✓ **Disk access**: Attackers with filesystem access cannot read message content
- ✓ **Backup exposure**: Backups of `data/conversations/` don't expose plaintext messages
- ✓ **Accidental disclosure**: Files accidentally shared don't reveal content

### What This Does NOT Protect Against
- ✗ **Runtime access**: If attacker has access to running process, messages are in memory
- ✗ **Key compromise**: If `.env` file is compromised, encryption is defeated
- ✗ **Metadata leakage**: Conversation titles, timestamps, etc. remain visible

### Best Practices

1. **Backup your encryption key**
   - Store `.env` file in password manager
   - Keep offline backup in secure location
   - Test backup restoration process

2. **Secure your `.env` file**
   - Add `.env` to `.gitignore` (already done)
   - Set restrictive file permissions: `chmod 600 .env`
   - Never commit `.env` to version control

3. **Key rotation** (future feature)
   - Currently not supported
   - Would require re-encrypting all conversations
   - Contact maintainer if key rotation needed

4. **Monitor for key loss**
   - If backend fails to start, check `ENCRYPTION_KEY` is present
   - Error: "Encrypted conversation found but encryption is disabled"
     → Key missing or `ENCRYPTION_ENABLED=false`

## Troubleshooting

### Error: "Failed to decrypt conversation"

**Cause:** Wrong encryption key or corrupted data

**Solutions:**
1. Check `ENCRYPTION_KEY` in `.env` matches the key used to encrypt
2. Restore correct `.env` from backup
3. If key permanently lost, conversations cannot be recovered

### Error: "ENCRYPTION_KEY not configured but encryption is enabled"

**Cause:** Missing encryption key in `.env`

**Solution:**
```bash
python generate_encryption_key.py
```

### Error: "Invalid Fernet key"

**Cause:** Malformed key in `.env` (wrong format, encoding, etc.)

**Solution:**
1. Check key is base64-encoded (44 characters)
2. No extra spaces or quotes around key
3. Regenerate key if corrupted: `python generate_encryption_key.py`

### Legacy Conversations Not Loading

**Cause:** Likely unrelated to encryption (encryption is backward compatible)

**Check:**
1. File exists in `data/conversations/profile_<id>/`
2. JSON is valid (run through JSON validator)
3. Check backend logs for specific error

## Testing

Run the encryption test suite to verify everything works:

```bash
python test_encryption.py
```

Tests include:
- Creating encrypted conversations
- Reading and decrypting conversations
- Loading legacy unencrypted files
- Re-encrypting legacy files on save
- Verifying content integrity

Expected output:
```
============================================================
Encryption Test Suite
============================================================
Encryption enabled: True

=== Test 1: Create Encrypted Conversation ===
✓ Created conversation: test-encrypted-conv
✓ Added user message
✓ Added assistant message
✓ File is encrypted on disk
✓ Loaded and decrypted conversation
✓ Messages decrypted correctly (2 messages)
✓ Message content verified
✓ Test conversation cleaned up

=== Test 2: Legacy Unencrypted Conversation ===
✓ Created legacy unencrypted conversation
✓ Loaded legacy conversation (backward compatible)
✓ Messages loaded correctly
✓ Re-saved conversation
✓ Legacy conversation re-encrypted on save
✓ Re-encrypted conversation loads correctly
✓ Test conversation cleaned up

============================================================
Test Results Summary
============================================================
✓ PASS: Encrypted Conversation
✓ PASS: Legacy Conversation

All tests passed! ✓
```

## Architecture

### Provider Abstraction

The encryption system uses a provider pattern to support future encryption schemes:

```python
# Abstract base class
class EncryptionProvider(ABC):
    @abstractmethod
    def encrypt(self, data: bytes) -> bytes: ...

    @abstractmethod
    def decrypt(self, ciphertext: bytes) -> bytes: ...

# Current implementation
class FernetProvider(EncryptionProvider):
    # Symmetric encryption using Fernet (AES-128-CBC)
    ...

# Future implementation (placeholder)
class RSAProvider(EncryptionProvider):
    # Hybrid encryption: RSA + AES
    ...
```

### File Structure

```
backend/
├── encryption.py      # Encryption provider classes and utilities
├── storage.py         # Modified for encrypt/decrypt on save/load
├── config.py          # Encryption configuration settings
├── ...

generate_encryption_key.py   # Key generation utility
test_encryption.py            # Comprehensive test suite
.env                          # Contains ENCRYPTION_KEY (DO NOT COMMIT)
```

## Future Enhancements

### Planned Features (Not Yet Implemented)

1. **Asymmetric Encryption (RSA)**
   - Public key encryption for sharing
   - Private key for decryption
   - Hybrid encryption: RSA for key wrapping + AES for data

2. **Per-Conversation Keys**
   - Each conversation encrypted with unique key
   - Master key encrypts per-conversation keys
   - Allows selective sharing

3. **Key Rotation**
   - Migrate to new encryption key
   - Re-encrypt all conversations
   - Zero-downtime rotation

4. **Multi-User Support**
   - User-specific encryption keys
   - Public profiles with separate keys
   - Shared conversation encryption

### Architecture Ready For

The current implementation includes:
- ✓ Provider abstraction layer (easy to add new providers)
- ✓ Version field in metadata (allows migration between schemes)
- ✓ Pluggable encryption/decryption functions
- ✓ Backward compatibility detection

## FAQ

**Q: What happens if I lose my encryption key?**
A: Your conversations are permanently lost. There is no key recovery mechanism. Always back up your `.env` file.

**Q: Can I use different keys for different profiles?**
A: Not currently. One key per installation. Multi-key support is a planned feature.

**Q: Does this slow down the application?**
A: Minimally. Encryption/decryption happens only during file I/O. In-memory operations are unaffected.

**Q: Can I decrypt files manually?**
A: Yes, using the Python cryptography library with your Fernet key. See `backend/encryption.py` for reference implementation.

**Q: Why isn't metadata encrypted?**
A: To allow conversation listing, search, and filtering without decrypting every file. This is a common pattern (e.g., email subject lines vs. body).

**Q: Can I migrate between encryption providers?**
A: Not yet, but the architecture supports it. The `_encryption.version` field will enable future migrations.

**Q: Is this military-grade encryption?**
A: Fernet uses AES-128-CBC which is considered secure for most applications. For higher security needs, consider implementing RSA/hybrid encryption (architecture supports it).

## Support

For issues, questions, or feature requests related to encryption:

1. Check this guide first
2. Run `python test_encryption.py` to verify installation
3. Check backend logs for specific error messages
4. Open an issue on the project repository

---

**Last Updated:** 2025-11-26
**Encryption Version:** 1.0
**Provider:** Fernet (AES-128-CBC)
