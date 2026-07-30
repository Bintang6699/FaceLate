"""switch face embedding to 128-dim browser descriptors

Revision ID: a1b2c3d4e5f6
Revises: f451b8e957ff
Create Date: 2026-07-30

Face embedding extraction moved from server-side InsightFace (512-dim,
too heavy for Vercel serverless) to browser-side face-api.js (128-dim).
Existing embeddings are incompatible with the new model, so they are
cleared — faces must be re-registered after this migration.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = 'f451b8e957ff'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Old 512-dim InsightFace embeddings can never match the new 128-dim
    # browser descriptors, so they are wiped. Re-register faces afterwards.
    op.execute("DELETE FROM face_embeddings")
    op.execute("ALTER TABLE face_embeddings DROP COLUMN embedding")
    op.execute("ALTER TABLE face_embeddings ADD COLUMN embedding vector(128) NOT NULL")


def downgrade() -> None:
    op.execute("DELETE FROM face_embeddings")
    op.execute("ALTER TABLE face_embeddings DROP COLUMN embedding")
    op.execute("ALTER TABLE face_embeddings ADD COLUMN embedding vector(512) NOT NULL")
