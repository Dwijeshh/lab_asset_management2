interface AssetActionsProps {
  asset: any;
  currentUser: any;
  onEdit: (asset: any) => void;
  onDelete: (id: number) => void;
  onRequest: (asset: any) => void;
  canDelete: boolean;
}

export default function AssetActions({ asset, currentUser, onEdit, onDelete, onRequest, canDelete }: AssetActionsProps) {
  const canRequest = asset.status === 'available' && currentUser?.labId && asset.labId !== currentUser.labId;
  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'main_technician' || asset.labId === currentUser?.labId;

  return (
    <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:justify-end">
      {canRequest && <button type="button" onClick={() => onRequest(asset)} className="record-action">Request</button>}
      {canEdit && <button type="button" onClick={() => onEdit(asset)} className="record-action">Edit</button>}
      {canDelete && <button type="button" onClick={() => onDelete(asset.id)} className="record-action record-action-danger">Delete</button>}
    </div>
  );
}
