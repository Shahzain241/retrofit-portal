import { Component } from "react";

/**
 * Shared ErrorBoundary — catches render/lifecycle errors in its subtree so a
 * crash in one section shows a friendly fallback instead of blanking the app.
 */
class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Error caught by boundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <p>Something went wrong loading this section.</p>
          <button type="button" onClick={() => this.setState({ hasError: false })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
