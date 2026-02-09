import { useEffect, useState } from "react";
import { useApi } from "../api/useApi";

export default function PickemOverview() {
  const api = useApi();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    api.get("/pickem/overview")
      .then(setData)
      .catch(err => console.error(err));
  }, []);

  return (
    <div>
      <h2>Pick'Em overview</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
