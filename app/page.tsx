import { SkylineExperience } from "@/components/skyline/SkylineExperience"
import { CITIES } from "@/lib/skyline/data"

export default function HomePage() {
  return (
    <main>
      <SkylineExperience />
      <div className="sr-only">
        <h2>Horizons: Five World Skylines Through Time</h2>
        <p>
          An interactive architectural elevation exploring how five iconic world
          cities rose along their rivers and harbors across centuries, scored to
          music with an open-sky nocturnal tour.
        </p>
        <ul>
          {CITIES.map((c) => (
            <li key={c.id}>
              {c.name} ({c.startYear} to {c.endYear}) — {c.waterbody}:{" "}
              {c.tagline}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

