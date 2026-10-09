import Image from 'next/image';
import Link from 'next/link';
import LandingMotion from './landing-motion';
import LandingSlider from './landing-slider';

const steps = [
  { n: '01', title: 'Đồng bộ lịch học', body: 'Đưa thời khóa biểu vào EduShift để thấy rõ những khoảng thời gian bạn có thể đi làm.' },
  { n: '02', title: 'Chọn ca vừa lịch', body: 'Xem gợi ý ca làm phù hợp với giờ rảnh và hồ sơ, rồi ứng tuyển ca bạn thích.' },
  { n: '03', title: 'Nhận ca, lên lịch', body: 'Khi doanh nghiệp chấp nhận, ca làm tự xuất hiện trên lịch cá nhân của bạn.' },
];

export default function Home() {
  return <main className="landing" id="top">
    <LandingMotion />
    <header className="landing-header">
      <Link href="/" className="landing-brand" aria-label="EduShift - Trang chủ"><span className="landing-brand-mark">E<span>✦</span></span><strong>Edu<span>Shift</span></strong></Link>
      <nav aria-label="Điều hướng chính"><a href="#loi-ich">Lợi ích</a><a href="#cach-hoat-dong">Cách hoạt động</a><a href="#doanh-nghiep">Doanh nghiệp</a></nav>
      <div className="landing-head-actions"><Link href="/login">Đăng nhập</Link><Link href="/register" className="landing-button landing-button-small">Bắt đầu ngay <span aria-hidden="true">↗</span></Link></div>
    </header>

    <section className="landing-hero">
      <div className="landing-hero-glow" aria-hidden="true" />
      <div className="landing-hero-inner">
        <div className="landing-hero-copy">
          <span className="landing-kicker"><i /> LỊCH HỌC CỦA BẠN, NHỊP LÀM VIỆC CỦA BẠN</span>
          <h1>Đi làm thêm<br /><em>vừa khít</em> lịch học<span className="landing-period">.</span></h1>
          <p>EduShift giúp bạn tìm ca phù hợp với thời khóa biểu, ứng tuyển dễ dàng và theo dõi lịch học, lịch làm trên cùng một nơi.</p>
          <div className="landing-actions"><Link href="/register" className="landing-button">Tìm ca dành cho bạn <span aria-hidden="true">↗</span></Link><a href="#cach-hoat-dong">Xem cách hoạt động <span aria-hidden="true">↓</span></a></div>
          <div className="landing-hero-note"><span aria-hidden="true">✳</span> Tự chọn ca bạn muốn nhận. Chủ động với mỗi ngày.</div>
        </div>
        <div className="landing-hero-visual">
          <div className="landing-photo-wrap"><Image src="/landing/students.jpg" alt="Nhóm sinh viên cùng học và trao đổi" fill priority sizes="(max-width: 900px) 100vw, 48vw" /></div>
          <div className="landing-photo-shape" aria-hidden="true">✳</div>
          <div className="landing-schedule-card">
            <div className="landing-schedule-top"><span>✦ &nbsp; Lịch của tôi</span><small>Tuần này ⌄</small></div>
            <div className="landing-schedule-days"><span>THỨ 2</span><span>THỨ 3</span><span>THỨ 4</span></div>
            <div className="landing-schedule-grid"><span className="study">Lịch học<small>08:00 – 11:00</small></span><span className="empty" /><span className="study">Lịch học<small>09:00 – 11:30</small></span><span className="empty" /><span className="work">Ca đã nhận ✓<small>13:00 – 17:00</small></span><span className="free">Giờ rảnh ✦<small>Có thể nhận ca</small></span></div>
          </div>
          <div className="landing-match-card"><span className="landing-match-icon">✦</span><div><small>CA PHÙ HỢP VỚI LỊCH RẢNH</small><strong>Nhân viên phục vụ</strong><span>Thứ ba · 13:00 – 17:00</span></div><b>↗</b></div>
        </div>
      </div>
      <div className="landing-hero-band"><span>HỌC HẾT MÌNH</span><b>✳</b><span>LÀM ĐÚNG LÚC</span><b>✳</b><span>CHỦ ĐỘNG MỖI NGÀY</span></div>
    </section>

    <section className="landing-section landing-intro" id="loi-ich">
      <div className="landing-section-head landing-reveal"><div><span className="landing-label">MỌI THỨ TRONG MỘT NƠI</span><h2>Để lịch học dẫn đường<br />cho công việc phù hợp.</h2></div><p>Không cần tự dò từng ca rồi so lại thời khóa biểu. EduShift đưa lịch học, cơ hội việc làm và ca đã nhận về cùng một chỗ.</p></div>
      <div className="landing-benefits">
        <article className="landing-reveal"><span className="landing-benefit-icon">▦</span><small>01 / RÕ RÀNG</small><h3>Biết khi nào bạn rảnh</h3><p>Đồng bộ lịch học hoặc tự nhập. Thời gian rảnh trở thành điểm bắt đầu để tìm việc.</p></article>
        <article className="landing-reveal"><span className="landing-benefit-icon">✦</span><small>02 / PHÙ HỢP</small><h3>Gặp đúng ca, đúng lúc</h3><p>Xem ca được gợi ý theo lịch rảnh và thông tin hồ sơ. Bạn quyết định ca nào đáng ứng tuyển.</p></article>
        <article className="landing-reveal"><span className="landing-benefit-icon">✓</span><small>03 / CHỦ ĐỘNG</small><h3>Nhận ca là lên lịch</h3><p>Khi đơn được chấp nhận, ca làm được thêm vào lịch cá nhân để bạn dễ theo dõi.</p></article>
      </div>
    </section>

    <section className="landing-stories"><div className="landing-stories-inner"><div className="landing-stories-head landing-reveal"><span className="landing-label">MỘT NHỊP SỐNG DỄ SẮP XẾP HƠN</span><h2>Việc làm hòa vào<br /><em>cuộc sống sinh viên.</em></h2><p>Trượt để xem EduShift giúp bạn đi từ thời khóa biểu đến lịch làm việc như thế nào.</p></div><LandingSlider /></div></section>

    <section className="landing-section landing-process" id="cach-hoat-dong"><div className="landing-process-head landing-reveal"><span className="landing-label">CÁCH EDU SHIFT HOẠT ĐỘNG</span><h2>Ba bước tới ca làm<br />phù hợp với bạn.</h2></div><div className="landing-steps">{steps.map(step => <article className="landing-reveal" key={step.n}><span className="landing-step-number">{step.n}</span><h3>{step.title}</h3><p>{step.body}</p></article>)}</div></section>

    <section className="landing-employer" id="doanh-nghiep"><div className="landing-employer-image landing-reveal"><Image src="/landing/team.jpg" alt="Nhóm làm việc cùng trao đổi và lên kế hoạch" fill sizes="(max-width: 800px) 100vw, 45vw" /></div><div className="landing-employer-copy landing-reveal"><span className="landing-label">DÀNH CHO DOANH NGHIỆP</span><h2>Ca trống cần người.<br /><em>Người phù hợp có mặt.</em></h2><p>Đăng ca, xem ứng viên cùng mức độ phù hợp về thời gian và kỹ năng, rồi chọn người cho đội của bạn.</p><Link href="/register" className="landing-button">Bắt đầu tuyển dụng <span aria-hidden="true">↗</span></Link></div></section>

    <section className="landing-final landing-reveal"><span className="landing-label">BẮT ĐẦU TỪ HÔM NAY</span><h2>Một lịch rõ ràng.<br /><em>Nhiều cơ hội mở ra.</em></h2><p>Tạo tài khoản EduShift và tìm ca làm phù hợp với nhịp học của bạn.</p><Link href="/register" className="landing-button">Khám phá ca làm <span aria-hidden="true">↗</span></Link></section>
    <footer className="landing-footer"><Link href="/" className="landing-brand"><span className="landing-brand-mark">E<span>✦</span></span><strong>Edu<span>Shift</span></strong></Link><small>© 2026 EduShift · Kết nối việc làm theo lịch học.</small><a href="#top">Lên đầu trang ↑</a></footer>
  </main>;
}
