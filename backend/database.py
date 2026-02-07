import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Use SQLite by default, or get DATABASE_URL from environment (Render)
SQLCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./tdm.db")

# Fix for Render/Heroku uses "postgres://" but SQLAlchemy needs "postgresql://"
if SQLCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLCHEMY_DATABASE_URL = SQLCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs specific args
connect_args = {"check_same_thread": False} if "sqlite" in SQLCHEMY_DATABASE_URL else {}

engine = create_engine(
    SQLCHEMY_DATABASE_URL, connect_args=connect_args
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
