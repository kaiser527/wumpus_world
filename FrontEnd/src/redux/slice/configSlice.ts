import { WorldConfig } from "@/types/backend";
import { DEFAULT_CONFIG } from "@/world/world";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface IState {
  config: WorldConfig;
}

const initialState: IState = {
  config: DEFAULT_CONFIG,
};

export const congigSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    setConfig: (state, action: PayloadAction<WorldConfig>) => {
      state.config = action.payload;
    },
  },
});

export const { setConfig } = congigSlice.actions;

export default congigSlice.reducer;
