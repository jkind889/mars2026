import Image from "next/image";
import aboveCoral from "@/data/assets/abovecoral.png";
import aboveFish from "@/data/assets/abovefish.png";
import belowCoral from "@/data/assets/belowcoral.png";
import belowFish from "@/data/assets/belowfish.png";

const ornaments = [
  {
    className: "site-ornament-fish site-ornament-fish-top-left",
    above: aboveFish,
    below: belowFish,
  },
  {
    className: "site-ornament-coral site-ornament-coral-top-right",
    above: aboveCoral,
    below: belowCoral,
  },
  {
    className: "site-ornament-fish site-ornament-fish-right",
    above: aboveFish,
    below: belowFish,
  },
  {
    className: "site-ornament-fish site-ornament-fish-bottom-left",
    above: aboveFish,
    below: belowFish,
  },
  {
    className: "site-ornament-coral site-ornament-coral-bottom-left",
    above: aboveCoral,
    below: belowCoral,
  },
  {
    className: "site-ornament-coral site-ornament-coral-bottom-right",
    above: aboveCoral,
    below: belowCoral,
  },
  {
    className: "site-ornament-coral site-ornament-coral-top-left-secondary",
    above: aboveCoral,
    below: belowCoral,
  },
  {
    className: "site-ornament-fish site-ornament-fish-mid-left",
    above: aboveFish,
    below: belowFish,
  },
  {
    className: "site-ornament-coral site-ornament-coral-mid-right",
    above: aboveCoral,
    below: belowCoral,
  },
  {
    className: "site-ornament-fish site-ornament-fish-bottom-right",
    above: aboveFish,
    below: belowFish,
  },
  {
    className: "site-ornament-fish site-ornament-fish-top-center",
    above: aboveFish,
    below: belowFish,
  },
  {
    className: "site-ornament-coral site-ornament-coral-bottom-center",
    above: aboveCoral,
    below: belowCoral,
  },
];

export function SiteOrnaments() {
  return (
    <div className="site-ornaments" aria-hidden="true">
      {ornaments.map((ornament) => (
        <div
          className={`site-ornament ${ornament.className}`}
          key={ornament.className}
        >
          <Image
            className="site-ornament-shadow"
            src={ornament.below}
            alt=""
            fill
            loading="eager"
            sizes="(max-width: 800px) 42vw, 32vw"
          />
          <Image
            className="site-ornament-art"
            src={ornament.above}
            alt=""
            fill
            loading="eager"
            sizes="(max-width: 800px) 42vw, 32vw"
          />
        </div>
      ))}
    </div>
  );
}
