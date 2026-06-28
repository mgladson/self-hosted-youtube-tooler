#!/bin/sh
set -e

echo "Configuring MinIO client..."
mc alias set local http://minio:9000 "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD"

echo "Creating buckets..."
mc mb --ignore-existing "local/$MINIO_BUCKET_FILES"
mc mb --ignore-existing "local/$MINIO_BUCKET_IMAGES"

echo "Setting public read policy on images bucket..."
mc anonymous set download "local/$MINIO_BUCKET_IMAGES"

# Seed the images bucket from the storefront's git-committed public/images/
# tree, but ONLY on first boot (empty bucket). On prod, this means the first
# deploy bootstraps MinIO from the repo, and subsequent restarts never
# clobber admin-uploaded changes. On dev, it gives a working stack out of
# the box without needing to manually upload every asset to MinIO.
if [ -d /seed/images ] && [ -z "$(mc ls "local/$MINIO_BUCKET_IMAGES" 2>/dev/null)" ]; then
  echo "Seeding $MINIO_BUCKET_IMAGES from /seed/images/ (bucket is empty)..."
  mc mirror --overwrite /seed/images/ "local/$MINIO_BUCKET_IMAGES/"
  echo "Seed complete."
else
  echo "Skipping seed (bucket has objects or /seed/images is missing)."
fi

echo "MinIO initialization complete."
echo "  - $MINIO_BUCKET_FILES (private)"
echo "  - $MINIO_BUCKET_IMAGES (public read)"
