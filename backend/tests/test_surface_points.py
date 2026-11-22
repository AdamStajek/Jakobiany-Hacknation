from wodo.spatial import surface_points


def test_downhill_bearing_local_minimum_and_flat():
    samples = [[5, 6, 4, 5, 5], [4, 5, 5, 5, 5], [5] * 5, [float("nan")] * 5]
    flow, low = surface_points([(500000, 500000)] * 4, samples)["features"]
    assert flow["properties"]["kind"] == "flow"
    assert 89 < flow["properties"]["bearing"] < 91
    assert low["properties"] == {"kind": "depression"}
