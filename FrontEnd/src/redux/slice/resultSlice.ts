import { ActionResult } from "@/types/backend";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface IState {
  data: (ActionResult & { runIndex: number })[];
}

const initialState: IState = {
  data: [],
};

export const resultSlice = createSlice({
  name: "result",
  initialState,
  reducers: {
    addData: (state, action: PayloadAction<ActionResult>) => {
      state.data.push({
        ...action.payload,
        runIndex: state.data.length + 1,
      });
    },
  },
});

export const { addData } = resultSlice.actions;

export default resultSlice.reducer;
