from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from typing import List
from uuid import UUID

from db.session import get_db
from db.models import CommunityPost, CommunityComment, Member, User, UserRole
from db.schemas import PostCreate, PostOut, CommentCreate, CommentOut
from api.dependencies import get_current_user, is_privileged

router = APIRouter()


def _get_display_name(user: User, db: Session) -> str:
    """Return first+last name from member/coach record, fallback to email prefix."""
    if user.role == UserRole.member and user.ref_id:
        member = db.query(Member).filter(Member.id == user.ref_id).first()
        if member:
            return f"{member.first_name} {member.last_name}"
    # Coach / trainer — use email prefix
    return user.email.split('@')[0].replace('.', ' ').title()


@router.get("/", response_model=List[PostOut])
def list_posts(db: Session = Depends(get_db), user=Depends(get_current_user)):
    posts = db.query(CommunityPost).order_by(CommunityPost.created_at.desc()).all()
    result = []
    for post in posts:
        comments = db.query(CommunityComment).filter(
            CommunityComment.post_id == post.id
        ).order_by(CommunityComment.created_at.asc()).all()
        out = PostOut.model_validate(post)
        out.comments = [CommentOut.model_validate(c) for c in comments]
        result.append(out)
    return result


@router.post("/", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(payload: PostCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Post content cannot be empty.")
    try:
        post = CommunityPost(
            author_email=user.email,
            author_name=_get_display_name(user, db),
            content=content,
            image_url=payload.image_url,
        )
        db.add(post)
        db.commit()
        db.refresh(post)
        out = PostOut.model_validate(post)
        out.comments = []
        return out
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to create post.")


@router.delete("/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    # Only author or privileged (coach/superuser) can delete
    if post.author_email != user.email and not is_privileged(user.email) and user.role != UserRole.coach:
        raise HTTPException(status_code=403, detail="Not allowed.")
    try:
        db.delete(post)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete post.")


@router.post("/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(post_id: UUID, payload: CommentCreate, db: Session = Depends(get_db), user=Depends(get_current_user)):
    post = db.query(CommunityPost).filter(CommunityPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found.")
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment cannot be empty.")
    try:
        comment = CommunityComment(
            post_id=post_id,
            author_email=user.email,
            author_name=_get_display_name(user, db),
            content=content,
        )
        db.add(comment)
        db.commit()
        db.refresh(comment)
        return CommentOut.model_validate(comment)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to add comment.")


@router.delete("/{post_id}/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_comment(post_id: UUID, comment_id: UUID, db: Session = Depends(get_db), user=Depends(get_current_user)):
    comment = db.query(CommunityComment).filter(
        CommunityComment.id == comment_id,
        CommunityComment.post_id == post_id,
    ).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found.")
    if comment.author_email != user.email and not is_privileged(user.email) and user.role != UserRole.coach:
        raise HTTPException(status_code=403, detail="Not allowed.")
    try:
        db.delete(comment)
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to delete comment.")
