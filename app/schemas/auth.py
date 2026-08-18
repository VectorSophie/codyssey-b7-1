from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_-]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=200)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime
    # 화면이 관리자 메뉴를 표시할 때만 사용할 서버 판정값이다.
    is_admin: bool

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    success: bool = True
    user: UserOut
