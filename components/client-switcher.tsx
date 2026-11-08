"use client";
import { SelectControl } from "./form-controls";
export function ClientSwitcher({ client }: { client: "tcs" | "ugc" }) {
  return (
    <div className="client-switcher">
      <SelectControl
        aria-label="Client workspace"
        value={client}
        onValueChange={(value) => {
          if (value === "tcs") window.location.assign("/");
          if (value === "ugc") window.location.assign("/ugc");
        }}
      >
        <option value="tcs">Creator Society</option>
        <option value="ugc">UGC Queen</option>
      </SelectControl>
    </div>
  );
}
