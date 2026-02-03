import "@/styles/controls.scss";
import { WorldConfig } from "@/types/type";

type Props = {
  config: WorldConfig;
  onChange: (c: WorldConfig) => void;
};

export default function WorldControls({ config, onChange }: Props) {
  return (
    <div className="controls">
      <label>
        Size
        <input
          type="number"
          min={4}
          max={9}
          value={config.size}
          onChange={(e) =>
            onChange({ ...config, size: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Pit
        <input
          type="number"
          step="0.05"
          min={0}
          max={0.4}
          value={config.pitProb}
          onChange={(e) =>
            onChange({ ...config, pitProb: Number(e.target.value) })
          }
        />
      </label>
      <label>
        Wumpus
        <input
          type="number"
          step="0.01"
          min={0}
          max={0.08}
          value={config.pitWumpus}
          onChange={(e) =>
            onChange({ ...config, pitWumpus: Number(e.target.value) })
          }
        />
      </label>
    </div>
  );
}
