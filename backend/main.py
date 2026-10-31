import os, secrets
from datetime import datetime, timezone, timedelta
from contextlib import asynccontextmanager
from typing import Literal
from fastapi import FastAPI, HTTPException, Header, Depends
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy import create_engine, Column, Integer, String, JSON, select
from sqlalchemy.orm import declarative_base, Session
from engine import assess

engine = create_engine(os.getenv('DATABASE_URL','postgresql+psycopg://transit:transit@localhost:5432/transit'), pool_pre_ping=True)
Base=declarative_base()
class Record(Base):
    __tablename__='records'
    id=Column(Integer,primary_key=True)
    kind=Column(String,index=True,nullable=False)
    data=Column(JSON,nullable=False)

def now(): return datetime.now(timezone.utc).isoformat()
def records(s,kind): return [dict(r.data,id=r.id) for r in s.scalars(select(Record).where(Record.kind==kind).order_by(Record.id))]
def add(s,kind,data):
    r=Record(kind=kind,data=data); s.add(r); s.commit(); s.refresh(r); return dict(r.data,id=r.id)
def db():
    with Session(engine) as s: yield s

def operator(x_operator_key: str=Header(default='')):
    key=os.getenv('OPERATOR_KEY','')
    if not key or not secrets.compare_digest(key,x_operator_key): raise HTTPException(403,'Operator açarı yanlışdır')

def seed():
    Base.metadata.create_all(engine)
    with Session(engine) as s:
        if s.scalar(select(Record).limit(1)): return
        for i,(route,name,lat,lng,seated,standing) in enumerate([('125','28 May → Ağ Şəhər',40.379,49.848,29,25),('18','İçərişəhər → Nərimanov',40.387,49.857,20,8),('65','Elmlər → Gənclik',40.397,49.831,30,35)]):
            add(s,'bus',dict(route=route,name=name,lat=lat,lng=lng,seats=30,standing_capacity=50,seated=seated,standing=standing,base_eta=4+i*3,previous_travel=6+i*2,following_eta=12,following_free=8,waiting=35+i*10,updated_at=now(),source='Demo telemetriya'))
        add(s,'event',dict(title='Konsert çıxışı — tələb artımı',route='125',type='event',delay=3,demand=45,verified=True,active=True,created_at=now(),source='Demo ssenari',passenger='Əlavə vaxt ayırın; dayanacaqlarda sıxlıq gözlənilir.'))
        add(s,'event',dict(title='Yol işi — hərəkət məhdudiyyəti',route='65',type='road',delay=6,demand=0,verified=True,active=True,created_at=now(),source='Demo ssenari',passenger='Daha tez çıxmağı və alternativ marşrutu nəzərdən keçirin.'))
@asynccontextmanager
async def lifespan(app):
    seed(); yield
app=FastAPI(title='YolBaku • Smart Transit REST API',version='1.0.0',lifespan=lifespan)

class Report(BaseModel):
    bus_id:int
    level:int=Field(ge=0,le=3)
    client_id:str=Field(min_length=8,max_length=80)
class Join(BaseModel):
    bus_id:int
    client_id:str=Field(min_length=8,max_length=80)
class Stop(BaseModel):
    session_id:str
class Event(BaseModel):
    title:str=Field(min_length=3,max_length=160)
    route:Literal['125','18','65']
    type:Literal['event','accident','road']
    delay:int=Field(ge=0,le=120)
    demand:int=Field(ge=0,le=500)
    passenger:str=Field(min_length=3,max_length=300)
class Telemetry(BaseModel):
    seated:int=Field(ge=0,le=30)
    standing:int=Field(ge=0,le=50)
    waiting:int=Field(ge=0,le=500)
    lat:float=Field(ge=39,le=42)
    lng:float=Field(ge=48,le=51)
class Action(BaseModel):
    bus_id:int
    action:Literal['review','reserve','monitor']

def get(s,id,kind):
    r=s.get(Record,id)
    if not r or r.kind!=kind: raise HTTPException(404,'Tapılmadı')
    return r
@app.get('/api/health')
def health(s:Session=Depends(db)):
    s.execute(select(1)); return {'status':'ok','database':'postgresql','mode':'demo'}
@app.get('/api/dashboard')
def dashboard(s:Session=Depends(db)):
    events=[e for e in records(s,'event') if e['active']]
    recent=(datetime.now(timezone.utc)-timedelta(minutes=10)).isoformat()
    reports=[r for r in records(s,'report') if r['created_at']>recent]
    buses=[dict(b,analysis=assess(b,events,reports)) for b in records(s,'bus')]
    return dict(buses=buses,events=events,mode='demo',updated_at=now())
@app.post('/api/reports',status_code=201)
def report(p:Report,s:Session=Depends(db)):
    get(s,p.bus_id,'bus')
    cutoff=(datetime.now(timezone.utc)-timedelta(seconds=60)).isoformat()
    if any(r['client_id']==p.client_id and r['bus_id']==p.bus_id and r['created_at']>cutoff for r in records(s,'report')): raise HTTPException(429,'Bir dəqiqə sonra yenidən bildirin')
    return add(s,'report',dict(**p.model_dump(),created_at=now(),verified=False))
@app.post('/api/join',status_code=201)
def join(p:Join,s:Session=Depends(db)):
    get(s,p.bus_id,'bus')
    return add(s,'session',dict(**p.model_dump(),token=secrets.token_urlsafe(24),created_at=now(),verification='demo-self-declared'))
@app.post('/api/stop',status_code=201)
def stop(p:Stop,s:Session=Depends(db)):
    sessions=[r for r in records(s,'session') if secrets.compare_digest(r['token'],p.session_id)]
    if not sessions: raise HTTPException(403,'Əvvəl reysə qoşulun')
    session=sessions[0]
    if datetime.fromisoformat(session['created_at'])<datetime.now(timezone.utc)-timedelta(hours=2): raise HTTPException(403,'Reys sessiyası bitib')
    existing=[r for r in records(s,'stop') if r['session_id']==p.session_id]
    if existing: return existing[0]
    return add(s,'stop',dict(session_id=p.session_id,bus_id=session['bus_id'],status='server_received',created_at=now(),message='Serverə çatdı. Avtobus təsdiqinədək fiziki STOP düyməsindən istifadə edin.'))
@app.get('/api/operator',dependencies=[Depends(operator)])
def ops(s:Session=Depends(db)):
    return dict(stops=[{k:v for k,v in r.items() if k!='session_id'} for r in records(s,'stop')],actions=records(s,'action'))
@app.post('/api/stops/{id}/ack',dependencies=[Depends(operator)])
def ack(id:int,s:Session=Depends(db)):
    r=get(s,id,'stop'); r.data=dict(r.data,status='driver_panel_acknowledged'); s.commit(); return {'status':'driver_panel_acknowledged'}
@app.get('/api/stop-status')
def stop_status(session_id:str,s:Session=Depends(db)):
    return [{'status':r['status'],'id':r['id']} for r in records(s,'stop') if secrets.compare_digest(r['session_id'],session_id)]
@app.post('/api/events',status_code=201,dependencies=[Depends(operator)])
def event(p:Event,s:Session=Depends(db)):
    return add(s,'event',dict(**p.model_dump(),verified=True,active=True,created_at=now(),source='Operator'))
@app.post('/api/events/{id}/close',dependencies=[Depends(operator)])
def close(id:int,s:Session=Depends(db)):
    r=get(s,id,'event'); r.data=dict(r.data,active=False); s.commit(); return {'closed':True}
@app.post('/api/telemetry/{id}',dependencies=[Depends(operator)])
def telemetry(id:int,p:Telemetry,s:Session=Depends(db)):
    r=get(s,id,'bus'); r.data=dict(r.data,**p.model_dump(),updated_at=now(),source='Operator / demo telemetriya'); s.commit(); return {'updated':True}
@app.post('/api/actions',status_code=201,dependencies=[Depends(operator)])
def action(p:Action,s:Session=Depends(db)):
    get(s,p.bus_id,'bus'); return add(s,'action',dict(**p.model_dump(),created_at=now(),status='Operator qərarı qeyd edildi; real dispetçer inteqrasiyası yoxdur'))
if os.path.isdir('/app/static'): app.mount('/',StaticFiles(directory='/app/static',html=True),name='ui')
