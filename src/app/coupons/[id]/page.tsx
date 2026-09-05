import { CouponRedeem } from "@/components/CouponRedeem";

type Props = { params: Promise<{ id: string }> };

export default async function CouponDetailPage({ params }: Props) {
  const { id } = await params;
  return <CouponRedeem id={id} />;
}
