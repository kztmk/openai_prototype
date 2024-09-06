import { combineReducers, configureStore } from '@reduxjs/toolkit';
import chat from './reducers/chatSlice';

const rootReducer = combineReducers({ chat });
export type RootState = ReturnType<typeof rootReducer>;

const store = configureStore({
  reducer: rootReducer,
});

export type AppDispatch = typeof store.dispatch;
export default store;
