from engine import assess
B=dict(id=1,route='125',seated=30,standing=40,seats=30,standing_capacity=50,waiting=65,following_free=5,following_eta=15,base_eta=4,previous_travel=6)
def test_capacity_and_reserve():
    a=assess(B,[],[])
    assert a['seat_percent']==100 and a['standing_percent']==80
    assert a['unmet']==50 and 'Rezerv' in a['recommendation']
def test_events_change_eta_and_demand():
    a=assess(B,[dict(route='125',delay=8,demand=20)],[])
    assert a['eta']==13 and a['demand']==85
def test_other_route_does_not_affect_bus():
    assert assess(B,[dict(route='18',delay=99,demand=99)],[])==assess(B,[],[])
def test_following_capacity_avoids_unnecessary_reserve():
    a=assess(dict(B,following_free=80),[],[])
    assert a['unmet']==0 and 'Mövcud' in a['recommendation']
def test_crowdsourcing_has_bounded_influence():
    baseline=assess(B,[],[])['occupancy']
    value=assess(B,[],[dict(bus_id=1,level=0)])['occupancy']
    assert 0<baseline-value<=20
