import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback: ReactNode
}

interface State {
  hasError: boolean
}

/**
 * HtmlEditor(Toast UI) iOS WebView 크래시 방어용 ErrorBoundary.
 * 에러 발생 시 페이지 전체가 흰 화면이 되는 대신 fallback을 보여줌.
 */
export default class EditorErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}
