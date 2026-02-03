import {
  Action,
  combineSlices,
  configureStore,
  ThunkAction,
} from "@reduxjs/toolkit";
import {
  persistReducer,
  persistStore,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";
import configSlice from "./slice/configSlice";
import resultSlice from "./slice/resultSlice";
import storage from "redux-persist/lib/storage";
import { getPersistConfig } from "redux-deep-persist";

const rootReducer = combineSlices({
  config: configSlice,
  result: resultSlice,
});

const persistConfig = getPersistConfig({
  key: "root",
  storage,
  whitelist: ["config", "result"],
  rootReducer,
});

export const store = configureStore({
  reducer: persistReducer(persistConfig, rootReducer),
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export type AppDispatch = typeof store.dispatch;
export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
