from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

from . import models, schemas, database, config

models.Base.metadata.create_all(bind=database.engine)

app = FastAPI(title="TDM - Test Data Management")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/massas/", response_model=schemas.Massa)
def create_massa(massa: schemas.MassaCreate, db: Session = Depends(get_db)):
    db_massa = models.Massa(**massa.dict())
    db.add(db_massa)
    db.commit()
    db.refresh(db_massa)
    return db_massa

@app.get("/massas/", response_model=List[schemas.Massa])
def read_massas(
    skip: int = 0, 
    limit: int = 10000,  # Increased to support larger datasets
    region: Optional[str] = None,
    status: Optional[str] = None,
    uc_status: Optional[str] = None,
    financial_status: Optional[str] = None, 
    db: Session = Depends(get_db)
):
    query = db.query(models.Massa)
    if region:
        query = query.filter(models.Massa.region == region)
    if status:
        query = query.filter(models.Massa.status == status)
    if uc_status:
        query = query.filter(models.Massa.uc_status == uc_status)
    if financial_status:
        query = query.filter(models.Massa.financial_status == financial_status)
        
    return query.offset(skip).limit(limit).all()

@app.get("/massas/{massa_id}", response_model=schemas.Massa)
def read_massa(massa_id: int, db: Session = Depends(get_db)):
    db_massa = db.query(models.Massa).filter(models.Massa.id == massa_id).first()
    if db_massa is None:
        raise HTTPException(status_code=404, detail="Massa not found")
    return db_massa

@app.put("/massas/{massa_id}", response_model=schemas.Massa)
def update_massa(massa_id: int, massa_update: schemas.MassaUpdate, db: Session = Depends(get_db)):
    db_massa = db.query(models.Massa).filter(models.Massa.id == massa_id).first()
    if not db_massa:
        raise HTTPException(status_code=404, detail="Massa not found")
    
    update_data = massa_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_massa, key, value)
    
    db.commit()
    db.refresh(db_massa)
    return db_massa

@app.post("/massas/checkout", response_model=schemas.Massa)
def checkout_massa(
    region: Optional[str] = None,
    uc_status: Optional[str] = None,
    financial_status: Optional[str] = None,
    consumer_id: str = "automated_test",
    db: Session = Depends(get_db)
):
    """
    Finds a FREE massa matching criteria, marks it IN_USE, and returns it.
    This is atomic for the user.
    """
    query = db.query(models.Massa).filter(models.Massa.status == "AVAILABLE")
    
    if region:
        query = query.filter(models.Massa.region == region)
    if uc_status:
        query = query.filter(models.Massa.uc_status == uc_status)
    if financial_status:
        query = query.filter(models.Massa.financial_status == financial_status)
        
    # Get the first match
    db_massa = query.first()
    
    if not db_massa:
        raise HTTPException(status_code=404, detail="No available massa found for criteria")
        
    db_massa.status = "IN_USE"
    db_massa.last_used_at = datetime.now()
    db_massa.last_used_by = consumer_id
    db.commit()
    db.refresh(db_massa)
    return db_massa

@app.post("/massas/{massa_id}/release")
def release_massa(massa_id: int, new_status: str = "AVAILABLE", db: Session = Depends(get_db)):
    db_massa = db.query(models.Massa).filter(models.Massa.id == massa_id).first()
    if not db_massa:
        raise HTTPException(status_code=404, detail="Massa not found")
        
    db_massa.status = new_status
    db.commit()
    return {"message": f"Massa {massa_id} released as {new_status}"}

@app.post("/massas/upload-csv")
def upload_csv(massas: List[schemas.MassaCreate], db: Session = Depends(get_db)):
    """
    Bulk create massas. Skips duplicates based on document_number.
    """
    count = 0
    skipped = 0
    seen_docs = set()
    
    for massa in massas:
        doc_num = massa.document_number
        
        # Skip if we've already seen this document in this batch
        if doc_num in seen_docs:
            skipped += 1
            continue
        seen_docs.add(doc_num)
        
        # Check if exists in database
        exists = db.query(models.Massa).filter(models.Massa.document_number == doc_num).first()
        if exists:
            skipped += 1
            continue
            
        db_massa = models.Massa(**massa.dict())
        db.add(db_massa)
        count += 1
    
    db.commit()
    return {"message": f"Importados {count} itens. {skipped} duplicados ignorados."}

@app.delete("/massas/all")
def delete_all_massas(db: Session = Depends(get_db)):
    """Delete all massas from the database"""
    count = db.query(models.Massa).delete()
    db.commit()
    return {"message": f"Deleted {count} massas"}

@app.delete("/massas/{massa_id}")
def delete_massa(massa_id: int, db: Session = Depends(get_db)):
    """Delete a single massa by ID"""
    db_massa = db.query(models.Massa).filter(models.Massa.id == massa_id).first()
    if not db_massa:
        raise HTTPException(status_code=404, detail="Massa not found")
    
    db.delete(db_massa)
    db.commit()
    db.delete(db_massa)
    db.commit()
    return {"message": f"Massa {massa_id} deleted"}

@app.get("/settings")
def get_settings():
    return config.load_settings()

@app.post("/settings")
def update_settings(settings: config.Settings):
    config.save_settings(settings)
    return settings
