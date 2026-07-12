"""What we can draft, and the text of each agreement.

The frontend renders the standard terms from this, so the templates live in one
place — the backend, which also needs them to know what to ask the user for.
"""

from dataclasses import asdict

from fastapi import APIRouter, HTTPException, status

from app.models import DocumentTemplate, DocumentTypeSummary
from app.templates import document_types, get_document_type

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("", response_model=list[DocumentTypeSummary])
def list_documents():
    return [
        DocumentTypeSummary(
            id=document.id,
            name=document.name,
            description=document.description,
            fields=document.fields,
        )
        for document in document_types().values()
    ]


@router.get("/{document_id}/template", response_model=DocumentTemplate)
def get_template(document_id: str):
    document = get_document_type(document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"There is no template for '{document_id}'.",
        )

    return DocumentTemplate(
        id=document.id,
        name=document.name,
        title=document.title,
        fields=document.fields,
        lines=[asdict(line) for line in document.lines],
    )
