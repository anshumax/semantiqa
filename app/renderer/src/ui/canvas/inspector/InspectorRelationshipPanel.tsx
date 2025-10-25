import { InspectorHeader } from './InspectorHeader';
import './InspectorRelationshipPanel.css';

export interface InspectorRelationshipPanelProps {
  relationshipId: string;
  onClose: () => void;
}

export function InspectorRelationshipPanel({ relationshipId, onClose }: InspectorRelationshipPanelProps) {
  // For now, this is a placeholder since relationship data would need to come from canvas state
  // In a full implementation, this would fetch relationship details from the canvas persistence layer
  
  return (
    <div className="inspector-relationship-panel">
      <InspectorHeader
        icon="🔗"
        title="Relationship"
        subtitle="Connection Details"
        onClose={onClose}
      />

      <div className="inspector-relationship-panel__content">
        <section className="inspector-section">
          <h3 className="inspector-section__title">Details</h3>
          <dl className="inspector-section__list">
            <div className="inspector-section__row">
              <dt>ID</dt>
              <dd className="inspector-relationship-id">{relationshipId}</dd>
            </div>
          </dl>
        </section>

        <div className="inspector-relationship-panel__placeholder">
          <p>Relationship inspector coming soon</p>
          <p className="inspector-relationship-panel__note">
            This panel will display:
          </p>
          <ul className="inspector-relationship-panel__features">
            <li>Source and target tables</li>
            <li>Column mappings</li>
            <li>Relationship type</li>
            <li>Confidence score</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

