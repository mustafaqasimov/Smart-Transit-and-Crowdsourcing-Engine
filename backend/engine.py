"""Explainable baseline, not a trained prediction model."""
def assess(bus, events, reports):
    delay = sum(e['delay'] for e in events if e['route'] == bus['route'])
    relevant = [r for r in reports if r['bus_id'] == bus['id']]
    sensor = (bus['seated'] + bus['standing']) / (bus['seats'] + bus['standing_capacity'])
    crowd = sum(r['level'] / 3 for r in relevant) / len(relevant) if relevant else sensor
    occupancy = round(100 * (sensor * .8 + crowd * .2))
    demand = bus['waiting'] + sum(e['demand'] for e in events if e['route'] == bus['route'])
    free = max(0, bus['seats'] + bus['standing_capacity'] - bus['seated'] - bus['standing'])
    unmet = max(0, demand - free - bus['following_free'])
    reserve = unmet > 10 and bus['following_eta'] > 8
    return dict(seat_percent=round(bus['seated']/bus['seats']*100), standing_percent=round(bus['standing']/bus['standing_capacity']*100), occupancy=occupancy,
        eta=round((bus['base_eta'] + bus['previous_travel'])/2 + delay), delay=delay, demand=demand, unmet=unmet,
        recommendation='Rezerv avtobus qiymətləndirilsin' if reserve else 'Mövcud xidmət izlənilsin',
        reason=f"Gözlənilən tələb: {demand}; boş tutum: {free}; sonrakı avtobus: {bus['following_eta']} dəq / {bus['following_free']} boş yer. Qarşılanmayan tələb: {unmet}.",
        confidence='orta', model='İzah edilən qayda modeli', reports=len(relevant))
