"""The agreements a user has started.

Called drafts, not documents, for two reasons: `/api/documents` is already the
catalogue of what we *can* draft, and a draft is what these are — the disclaimer
on every page says so.

Every query is scoped to the signed-in user. Another user's draft does not come
back as forbidden; it comes back as absent, because whether it exists is not
theirs to learn.
"""

import json
import sqlite3

from fastapi import APIRouter, HTTPException, status

from app import database
from app.dependencies import CurrentUser, DbConnection
from app.models import DraftRequest, DraftResponse, DraftSummary
from app.nda import NDA_FIELDS
from app.templates import MUTUAL_NDA_ID, get_document_type

router = APIRouter(prefix="/api/drafts", tags=["drafts"])

NOT_FOUND = "That draft does not exist."


def document_name(document_type: str) -> str:
    document = get_document_type(document_type)
    return document.name if document else document_type


def count_blanks(document_type: str, values: dict) -> int:
    """How much of the agreement is still owed, for the list to show."""
    if document_type == MUTUAL_NDA_ID:
        # The NDA's values are typed, and a term is filled by a pair of keys.
        return sum(1 for field in NDA_FIELDS if not str(values.get(field, "")).strip())

    document = get_document_type(document_type)
    if document is None:
        return 0
    return sum(1 for field in document.fields if not str(values.get(field, "")).strip())


def to_response(row: sqlite3.Row) -> DraftResponse:
    return DraftResponse(
        id=row["id"],
        documentType=row["document_type"],
        name=document_name(row["document_type"]),
        values=json.loads(row["values_json"]),
        messages=json.loads(row["messages_json"]),
        updated_at=row["updated_at"],
    )


@router.get("", response_model=list[DraftSummary])
def list_drafts(user: CurrentUser, db: DbConnection):
    drafts = []
    for row in database.list_drafts(db, user["id"]):
        values = json.loads(row["values_json"])
        drafts.append(
            DraftSummary(
                id=row["id"],
                documentType=row["document_type"],
                name=document_name(row["document_type"]),
                blanks=count_blanks(row["document_type"], values),
                updated_at=row["updated_at"],
            )
        )
    return drafts


@router.post("", response_model=DraftResponse, status_code=status.HTTP_201_CREATED)
def create_draft(draft: DraftRequest, user: CurrentUser, db: DbConnection):
    row = database.create_draft(
        db,
        user["id"],
        draft.documentType,
        draft.values,
        [message.model_dump() for message in draft.messages],
    )
    return to_response(row)


@router.get("/{draft_id}", response_model=DraftResponse)
def get_draft(draft_id: int, user: CurrentUser, db: DbConnection):
    row = database.get_draft(db, user["id"], draft_id)
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return to_response(row)


@router.put("/{draft_id}", response_model=DraftResponse)
def save_draft(draft_id: int, draft: DraftRequest, user: CurrentUser, db: DbConnection):
    row = database.update_draft(
        db,
        user["id"],
        draft_id,
        draft.documentType,
        draft.values,
        [message.model_dump() for message in draft.messages],
    )
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
    return to_response(row)


@router.delete("/{draft_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_draft(draft_id: int, user: CurrentUser, db: DbConnection):
    if not database.delete_draft(db, user["id"], draft_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=NOT_FOUND)
