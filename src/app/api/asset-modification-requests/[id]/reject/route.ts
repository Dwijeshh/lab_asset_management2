import { NextRequest } from 'next/server';
import { reviewAssetModification } from '@/lib/reviewAssetModification';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return reviewAssetModification(request, params, 'rejected');
}
