from datetime import date
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator
from shapely.geometry import Point, shape

from wodo.recommendation_catalog import observation_options

Answer = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=150)]
FIELD_OBSERVATIONS = {option["key"] for option in observation_options()}
POINT_OBSERVATIONS = {option["key"] for option in observation_options(local=True)}


class DeclaredPoint(BaseModel):
    model_config = ConfigDict(extra="forbid")
    type: Literal["Point"]
    coordinates: tuple[
        Annotated[float, Field(ge=-180, le=180)],
        Annotated[float, Field(ge=-90, le=90)],
    ]


class ProblemZone(BaseModel):
    model_config = ConfigDict(extra="forbid")
    geometry: DeclaredPoint
    type: Literal["Przesuszenie", "Zastoiska", "Erozja", "Słaby plon", "Inne"]
    date: date
    description: str = Field(default="", max_length=150)
    recommendation_observations: list[Answer] = Field(default_factory=list, max_length=len(POINT_OBSERVATIONS))

    @field_validator("recommendation_observations")
    @classmethod
    def known_point_observations(cls, keys):
        if not set(keys) <= POINT_OBSERVATIONS:
            raise ValueError("Nieznana obserwacja dla punktu.")
        return keys


class Watering(BaseModel):
    model_config = ConfigDict(extra="forbid")
    date: date
    dose_mm: float | None = Field(default=None, ge=0, allow_inf_nan=False)


class FarmerAnswers(BaseModel):
    model_config = ConfigDict(extra="forbid")
    previous_crop: Answer | None = None
    soil_texture_reported: Answer | None = None
    drought_frequency: Answer | None = None
    ponding_frequency: Answer | None = None
    surface_runoff_frequency: Answer | None = None
    drainage_status: Answer | None = None
    tillage_system: Answer | None = None
    residue_management: Answer | None = None
    cover_crop_use: Answer | None = None
    irrigation_water_source: list[Answer] = Field(default_factory=list, max_length=7)
    irrigation_events: list[Watering] | None = Field(default=None, max_length=100)
    problem_zones: list[ProblemZone] = Field(default_factory=list, max_length=30)
    recommendation_observations: list[Answer] = Field(default_factory=list, max_length=len(FIELD_OBSERVATIONS))

    @field_validator("recommendation_observations")
    @classmethod
    def known_field_observations(cls, keys):
        if not set(keys) <= FIELD_OBSERVATIONS:
            raise ValueError("Nieznana obserwacja dla pola.")
        return keys

    def validate_dates(self, day: date):
        if any(entry.date > day for entry in [*self.problem_zones, *(self.irrigation_events or [])]):
            raise ValueError("Data obserwacji lub nawadniania nie może wykraczać poza dzień analizy.")
        if len(self.irrigation_water_source) > 1 and any(
            source.lower() == "brak dostępu" for source in self.irrigation_water_source
        ):
            raise ValueError("Wybierz brak dostępu albo wskaż dostępne źródła wody.")

    def validate_zones(self, geometry: dict):
        if self.problem_zones:
            boundary = shape(geometry)
            if any(not boundary.covers(Point(*zone.geometry.coordinates)) for zone in self.problem_zones):
                raise ValueError("Zaznacz strefy wewnątrz granicy pola.")
