import { createHashRouter } from 'react-router-dom';
import ErrorBoundary from '../components/ErrorBoundary/ErrorBoundary';
import { LayoutBody } from '@/layout/LayoutBody';
import EditorPage from '@/views/editor/EditorPage';
import HomePage from '@/views/home/HomePage';
import { masRoutes } from '@/views/mas/routes';

export const router = [
  {
    element: (
      <ErrorBoundary>
        <LayoutBody />
      </ErrorBoundary>
    ),
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/editor', element: <EditorPage /> },
      ...masRoutes,
    ],
  },
];

export default createHashRouter(router, {
  future: { v7_relativeSplatPath: true },
});
