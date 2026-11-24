import { type FormEvent } from "react";
import { type Driver, type Service, type Vehicle } from "../operations";

export type List = { entries: Service[]; active: Service[]; upcoming: Service[]; total: number };
export type Profile = { kind: "driver" | "vehicle"; id: string; name: string };
export type OpenProfile = (profile: Profile) => void;
export const values = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return new FormData(event.currentTarget);
};
export const text = (f: FormData, key: string) => String(f.get(key) ?? "");
export const serviceSubtitle = (entry: Service) =>
  [
    entry.driver?.fullName ?? "Chofer por asignar",
    entry.vehicle ? vehicleLabel(entry.vehicle) : "Vehículo por asignar",
  ].join(" · ");
export const vehicleLabel = (v: { model: string | null; roleCode: string }) =>
  `${v.model || "Modelo no registrado"} · Móvil ${v.roleCode}`;
export const driverVehicleLabel = (entry: Service, driverId: string) => {
  const driven = [
    ...new Set(
      entry.legs
        .filter((leg) => leg.driver.id === driverId)
        .map((leg) => vehicleLabel(leg.vehicle)),
    ),
  ];
  return driven.length
    ? driven.join(" / ")
    : entry.vehicle
      ? vehicleLabel(entry.vehicle)
      : "Vehículo por asignar";
};
export const vehicleDriverLabel = (entry: Service, vehicle: Vehicle | null | undefined) => {
  const drivers = [
    ...new Set(
      entry.legs
        .filter((leg) => leg.vehicle.licensePlate === vehicle?.licensePlate)
        .map((leg) => leg.driver.fullName),
    ),
  ];
  return drivers.length ? drivers.join(" / ") : (entry.driver?.fullName ?? "Chofer por asignar");
};
export const vehicleOptions = (vehicles: Vehicle[]) =>
  vehicles
    .filter((v) => v.active)
    .map((v) => (
      <option key={v.id} value={v.id}>
        {vehicleLabel(v)}
        {v.inService ? " · En servicio" : ""}
      </option>
    ));
export const driverOptions = (drivers: Driver[]) =>
  drivers.map((d) => (
    <option key={d.id} value={d.id}>
      {d.fullName}
      {d.serviceLegs.length ? " · En servicio" : ""}
    </option>
  ));
export type Mutation = (
  path: string,
  body: unknown,
  method?: string,
  onError?: (message: string) => void,
) => Promise<boolean>;

export function routeLink(destinations: string[]): string {
  if (destinations.length <= 1) {
    return (
      "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(destinations[0] ?? "")
    );
  }
  const query = new URLSearchParams({
    api: "1",
    destination: destinations[destinations.length - 1],
    waypoints: destinations.slice(0, -1).join("|"),
  });
  return "https://www.google.com/maps/dir/?" + query;
}
