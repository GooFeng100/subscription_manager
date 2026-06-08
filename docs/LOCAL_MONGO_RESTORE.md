# Local MongoDB Backup and Restore

## Why dump from the legacy volume
The local split keeps the legacy MongoDB data in an old Docker volume, while `shared-data` now owns the running MongoDB instance. Dumping from the legacy volume lets us migrate real historical data into `shared-mongo` without deleting or mutating the old volume.

## How to identify the correct legacy volume
Check both candidate volumes and inspect the mounted data with a temporary MongoDB container:

- `subscription_manager_mongodb_data`
- `subscription-manager_mongodb_data`

The correct volume is the one whose `listDatabases` output includes `subscription_manager` and whose collections match the expected application data model.

## How to back up
Use the dump script from the project root:

```bash
scripts/local-mongo-dump-from-legacy-volume.sh
```

The script:

- checks that `shared-mongo` is running
- locates the legacy volume with `subscription_manager`
- prompts before dumping
- writes an archive like `backups/subscription_manager_local_YYYYMMDD_HHMMSS.archive.gz`
- does not delete the legacy volume

## How to restore to shared-mongo
Use the restore script after you have a verified archive:

```bash
scripts/local-mongo-restore-to-shared.sh backups/subscription_manager_local_YYYYMMDD_HHMMSS.archive.gz
```

The script:

- checks that `shared-mongo` is running
- checks that the archive exists
- warns that restore uses `mongorestore --drop`
- copies the archive into `shared-mongo`
- restores the `subscription_manager` database into the shared MongoDB instance

## Why `--drop` is acceptable locally
Local演练可以使用 `--drop`，因为这里的目标是验证迁移流程和还原结果，而不是保留并行写入状态。`--drop` 让 restore 结果更接近一次干净的目标库落地，减少残留旧集合导致的误判。

## Cloud safety rules
Do not delete old cloud data directories directly.

- first run `mongodump`
- download and verify the backup archive
- rename old data directories to `.bak` before cutover if needed
- restore into the new target after the new service is healthy
- keep rollback material until the new stack is fully validated

## How to verify
After restore and app restart, verify these endpoints:

- `curl -i http://localhost:8084/health`
- `curl -i http://localhost:8084/config`
- `curl -i "http://localhost:8084/sub/<valid-token>?target=clash"`

If you do not know a valid token, query MongoDB for subscription token fields and confirm the actual schema before testing. Use a placeholder such as `<有效token>` in documentation instead of copying a real token into Git.
