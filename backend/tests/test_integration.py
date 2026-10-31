"""Runs against a dedicated PostgreSQL database; never resets the app DB."""
import os
os.environ['DATABASE_URL']=os.environ['TEST_DATABASE_URL']
os.environ['OPERATOR_KEY']='integration-only-key'
import pytest
from fastapi.testclient import TestClient
from main import app,Base,engine
@pytest.fixture(scope='module')
def c():
    assert engine.url.database.endswith('_test'), 'Dedicated _test database required'
    Base.metadata.drop_all(engine)
    with TestClient(app) as client: yield client
    Base.metadata.drop_all(engine)
H={'X-Operator-Key':'integration-only-key'}
def test_health_and_seed(c):
    assert c.get('/api/health').json()['status']=='ok'
    assert len(c.get('/api/dashboard').json()['buses'])==3
def test_operator_auth(c):
    assert c.get('/api/operator').status_code==403
    assert c.get('/api/operator',headers=H).status_code==200
def test_reports_validation_rate_limit(c):
    bus=c.get('/api/dashboard').json()['buses'][0]['id']
    p=dict(bus_id=bus,client_id='test-device-123',level=3)
    assert c.post('/api/reports',json=p).status_code==201
    assert c.post('/api/reports',json=p).status_code==429
    assert c.post('/api/reports',json=dict(p,level=9)).status_code==422
    assert c.post('/api/reports',json=dict(p,bus_id=999)).status_code==404
def test_stop_join_dedup_and_ack(c):
    assert c.post('/api/stop',json={'session_id':'bad'}).status_code==403
    bus=c.get('/api/dashboard').json()['buses'][0]['id']
    session=c.post('/api/join',json=dict(bus_id=bus,client_id='test-device-stop')).json()
    p={'session_id':session['token']}
    first=c.post('/api/stop',json=p).json()
    assert c.post('/api/stop',json=p).json()['id']==first['id']
    assert c.post(f"/api/stops/{first['id']}/ack",json={}).status_code==403
    assert c.post(f"/api/stops/{first['id']}/ack",json={},headers=H).status_code==200
    assert c.get('/api/stop-status',params=p).json()[0]['status']=='driver_panel_acknowledged'
    assert 'session_id' not in c.get('/api/operator',headers=H).json()['stops'][0]
def test_event_lifecycle_changes_eta(c):
    before=c.get('/api/dashboard').json()['buses'][0]['analysis']['eta']
    event=dict(title='Integration accident',route='125',type='accident',delay=7,demand=20,passenger='Alternativ yolu seçin')
    assert c.post('/api/events',json=event).status_code==403
    e=c.post('/api/events',json=event,headers=H).json()
    assert c.get('/api/dashboard').json()['buses'][0]['analysis']['eta']==before+7
    assert c.post(f"/api/events/{e['id']}/close",json={},headers=H).status_code==200
    assert c.get('/api/dashboard').json()['buses'][0]['analysis']['eta']==before
def test_telemetry_and_decision_persist(c):
    bus=c.get('/api/dashboard').json()['buses'][0]
    p=dict(seated=12,standing=5,waiting=10,lat=40.38,lng=49.85)
    assert c.post('/api/telemetry/'+str(bus['id']),json=p,headers=H).status_code==200
    assert c.get('/api/dashboard').json()['buses'][0]['analysis']['seat_percent']==40
    assert c.post('/api/actions',json=dict(bus_id=bus['id'],action='reserve'),headers=H).status_code==201
    assert len(c.get('/api/operator',headers=H).json()['actions'])==1
