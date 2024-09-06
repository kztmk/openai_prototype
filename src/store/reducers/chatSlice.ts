import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import OpenAI, {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIUserAbortError,
  AuthenticationError,
  BadRequestError,
  ConflictError,
  InternalServerError,
  NotFoundError,
  PermissionDeniedError,
  RateLimitError,
  UnprocessableEntityError,
} from 'openai';

// OpenAI APIの設定
const client = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY as string,
  dangerouslyAllowBrowser: true,
});

/*
 * Model: gpt-4o
 * context window: 128K
 *
 * Model: gpt-4o-mini
 * context window: 16K
 */

type ChatCompletionMessageParam =
  | OpenAI.Chat.ChatCompletionSystemMessageParam
  | OpenAI.Chat.ChatCompletionAssistantMessageParam
  | OpenAI.Chat.ChatCompletionUserMessageParam;

interface ChatState {
  message: string;
  isLoading: boolean;
  error: string | null;
  model: 'gpt-4o' | 'gpt-4o-mini';
}

const initialState: ChatState = {
  message: '',
  isLoading: false,
  error: null,
  model: 'gpt-4o-mini',
};

const handleApiError = (error: unknown) => {
  if (error instanceof ConflictError) {
    return 'エラー: リクエストが競合しています。別のリクエストが同時に処理中です。';
  } else if (error instanceof NotFoundError) {
    return 'エラー: リクエストされたリソースが見つかりませんでした。';
  } else if (error instanceof RateLimitError) {
    return 'エラー: レート制限を超えました。しばらくしてからもう一度お試しください。';
  } else if (error instanceof BadRequestError) {
    return 'エラー: リクエストが無効です。リクエスト内容を確認してください。';
  } else if (error instanceof APIUserAbortError) {
    return 'エラー: ユーザーによってリクエストが中止されました。';
  } else if (error instanceof APIConnectionError) {
    return 'エラー: APIへの接続に失敗しました。ネットワーク設定を確認してください。';
  } else if (error instanceof UnprocessableEntityError) {
    return 'エラー: リクエストの内容を処理できません。入力データを確認してください。';
  } else if (error instanceof AuthenticationError) {
    return 'エラー: 認証に失敗しました。APIキーを確認してください。';
  } else if (error instanceof InternalServerError) {
    return 'エラー: サーバー内部でエラーが発生しました。しばらくしてからもう一度お試しください。';
  } else if (error instanceof PermissionDeniedError) {
    return 'エラー: アクセス権限がありません。必要な権限を確認してください。';
  } else if (error instanceof APIConnectionTimeoutError) {
    return 'エラー: API接続がタイムアウトしました。ネットワークを確認して再試行してください。';
  } else {
    return '不明なエラーが発生しました。';
  }
};

export const sendMessage = createAsyncThunk<
  ChatCompletionMessageParam[],
  { messages: ChatCompletionMessageParam[]; model: 'gpt-4o' | 'gpt-4o-mini' },
  { rejectValue: string }
>('chat/sendMessage', async (args, thunkAPI) => {
  const { rejectWithValue } = thunkAPI;
  let fullResponse = '';
  let shouldContinue = true;
  const messages = [...args.messages]; // 初期のメッセージ
  try {
    // レスポンスが途中終了している限り、続けてリクエストを送信
    while (shouldContinue) {
      const response = await client.chat.completions.create({
        model: args.model,
        messages: messages,
        stream: true,
      });

      for await (const chunk of response as any) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;

        // `finish_reason` を確認
        const finishReason = chunk.choices[0]?.finish_reason;

        if (finishReason === 'length' || finishReason === null) {
          // トークンの制限または `null` の場合、再リクエスト
          shouldContinue = true;
          messages.push({ role: 'assistant', content: fullResponse }); // 新たなアシスタントメッセージを追加
        } else if (finishReason === 'stop') {
          // 応答が完全に終了した場合
          shouldContinue = false;
          messages.push({ role: 'assistant', content: fullResponse }); // 最終的な応答を追加
          return messages; // メッセージを返す
        } else if (finishReason === 'filtered_content') {
          // フィルタリングされた場合はエラー
          return rejectWithValue(
            `エラー: 応答がフィルタリングされました。 finish_reason: ${finishReason}`
          );
        }
      }
    }

    // 最後に fullResponse が残っている場合、追加
    if (fullResponse) {
      messages.push({ role: 'assistant', content: fullResponse });
    }

    return messages;
  } catch (error) {
    return rejectWithValue(handleApiError(error));
  }
});

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const messages = action.payload;
        const lastMessage = messages[messages.length - 1];

        if (
          lastMessage.role === 'assistant' &&
          typeof lastMessage.content === 'string'
        ) {
          state.message = lastMessage.content || '';
        }
        state.isLoading = false;
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.error.message || 'An error occurred';
      });
  },
});

export const selectChat = (state: { chat: ChatState }) => state.chat;
export default chatSlice.reducer;
