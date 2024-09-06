import { useState } from 'react';
import { useAppDispatch, useAppSelector } from './hooks/rtkhooks';
import { sendMessage } from './store/reducers/chatSlice';

function App() {
  const [input, setInput] = useState('');

  const dispatch = useAppDispatch();
  const { message, isLoading, error } = useAppSelector((state) => state.chat);

  const handleSend = () => {
    dispatch(
      sendMessage({
        messages: [{ role: 'user', content: input }],
        model: 'gpt-4o-mini',
      })
    );
  };

  return (
    <div>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={handleSend} disabled={isLoading}>
        Send
      </button>

      {isLoading && <p>Loading...</p>}
      {error && <p>Error: {error}</p>}
      <p>Response: {message}</p>
    </div>
  );
}

export default App;
