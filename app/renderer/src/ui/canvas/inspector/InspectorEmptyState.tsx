import './InspectorEmptyState.css';

export function InspectorEmptyState() {
  return (
    <div className="inspector-empty-state">
      <div className="inspector-empty-state__icon">📋</div>
      <h3 className="inspector-empty-state__title">No Selection</h3>
      <p className="inspector-empty-state__message">
        Select a data source or relationship to view details
      </p>
    </div>
  );
}

