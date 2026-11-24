import { SkylineExperience } from "@/components/skyline/SkylineExperience"

export default function HomePage() {
  return (
    <main>
      <SkylineExperience />
      <div className="sr-only">
        <h2>About Brandon Lai</h2>
        <p>
          Cities aren&apos;t built in a day, but truly great cities take vision,
          ambition, energy, and focus. So does everything worthwhile in life.
        </p>
        <ul>
          <li>Software engineer</li>
          <li>Tennis player</li>
          <li>Marathoner, ex-rower</li>
          <li>Tiramisu World Cup competitor, Canada semi-finalist</li>
          <li>Beginner guitarist, scuba diver, snowboarder</li>
        </ul>
        <p>
          Vintage watch collector at{" "}
          <a href="https://instagram.com/watcheswbrandon">@watcheswbrandon</a>.
        </p>
        <h2>Work</h2>
        <ul>
          <li>LinkedIn — Software Engineer (Sep 2022–Present)</li>
          <li>Hearth — Full-Stack Software Engineer Intern (May–Aug 2022)</li>
          <li>8VC — Engineering Fellow (May–Aug 2022)</li>
          <li>LinkedIn — Software Engineer Intern (May–Aug 2021)</li>
          <li>smoodi — Founding Engineer (Jun 2019–Sep 2020)</li>
        </ul>
        <p>
          <a href="https://www.linkedin.com/in/brandon-lai">
            Reach out on LinkedIn
          </a>
        </p>
      </div>
    </main>
  )
}

