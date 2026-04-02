import QuizEditor from './components/QuizEditor';
import QuizPlayerPage from './components/QuizPlayerPage';
import { FirebaseProvider } from './components/FirebaseProvider';
import { ErrorBoundary } from './components/ErrorBoundary';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const quizId = params.get('quizId');

  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <div className="min-h-screen">
          {quizId ? <QuizPlayerPage /> : <QuizEditor />}
        </div>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}
