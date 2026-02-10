import { useEffect, useState } from "react";
import { PickemOverviewDTO } from "../pickem/types";
import { useParams } from "react-router-dom";
import { usePublicApi } from "./usePublicApi";

export function usePublicPickemOverview() {
  return {
    loading: false,
    data: {
      event: { name: "IEM Kraków 2026" },
      participants: 468,
      deadline: new Date().toISOString(),
      status: "OPEN",
    },
  };
}
