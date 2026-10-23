export const metadata = {
  title: "포리펀드 외부 삽입 조회 데모",
  robots: { index: false, follow: false },
};

/** 실제 신청을 비활성화한 조회 전용 iframe 예시를 제공합니다. */
export default function QuickEstimateDemoPage() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  return (
    <main className="mx-auto w-full max-w-3xl p-4">
      <h1 className="text-xl font-bold">예상 환급액 조회 데모</h1>
      <p>
        조회 전용 예시입니다. 이 화면에서는 상담 정보를 받거나 실제 접수·알림을 발생시키지 않습니다.
      </p>
      <iframe
        title="조회 전용 예시"
        src={`${basePath}/embed/quick-estimate.html?mode=inline&demo=1`}
        className="h-[800px] w-full border-0"
      />
    </main>
  );
}
