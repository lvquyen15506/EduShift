'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

const SLIDE_INTERVAL = 5500;

const slides = [
  { tag: '01 / LỊCH HỌC', title: 'Giờ học là ưu tiên.', description: 'Đưa thời khóa biểu vào một lần để nhìn rõ những khoảng trống trong tuần.', image: '/landing/students.jpg', alt: 'Sinh viên cùng học và trao đổi' },
  { tag: '02 / CA LÀM', title: 'Chọn ca theo nhịp của bạn.', description: 'Tập trung vào những ca phù hợp với thời gian rảnh, kỹ năng và mong muốn của mình.', image: '/landing/team.jpg', alt: 'Nhóm cộng sự đang lên kế hoạch làm việc' },
  { tag: '03 / LỊCH CÁ NHÂN', title: 'Mọi kế hoạch ở một nơi.', description: 'Khi được nhận, ca làm tự nằm cạnh lịch học để bạn luôn biết tuần này có gì.', image: '/landing/planning.jpg', alt: 'Sinh viên ghi chép và lên kế hoạch học tập' },
];

export default function LandingSlider() {
  const [active, setActive] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isTouching, setIsTouching] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const canAutoPlay = isVisible && pageVisible && !reduceMotion && !isHovered && !isFocused && !isTouching;

  useEffect(() => {
    const slider = sliderRef.current;
    if (!slider || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(slider);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReduceMotion(media.matches);
    const updateVisibility = () => setPageVisible(document.visibilityState === 'visible');
    updateMotion();
    updateVisibility();
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      media.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);

  useEffect(() => {
    if (!canAutoPlay) return;
    const timeout = window.setTimeout(() => setActive(current => (current + 1) % slides.length), SLIDE_INTERVAL);
    return () => window.clearTimeout(timeout);
  }, [active, canAutoPlay]);

  const move = (direction: number) => setActive(current => (current + direction + slides.length) % slides.length);
  return <div ref={sliderRef} className={`landing-slider landing-reveal${canAutoPlay ? '' : ' is-paused'}`} role="region" aria-roledescription="carousel" aria-label="Các bước sử dụng EduShift" onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} onFocusCapture={() => setIsFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsFocused(false); }} onTouchStart={() => setIsTouching(true)} onTouchEnd={() => setIsTouching(false)} onTouchCancel={() => setIsTouching(false)}>
    <div className="landing-slider-window"><div className="landing-slider-track" style={{ transform: `translateX(-${active * 100}%)` }}>{slides.map((slide, index) => <article className="landing-slide" key={slide.tag} role="group" aria-roledescription="slide" aria-label={`${index + 1} / ${slides.length}`} aria-hidden={active !== index}><div className="landing-slide-image"><Image src={slide.image} alt={slide.alt} fill sizes="(max-width: 700px) 100vw, 55vw" /></div><div className="landing-slide-copy"><span>{slide.tag}</span><h3>{slide.title}</h3><p>{slide.description}</p></div></article>)}</div></div>
    <div className="landing-slider-controls"><div className="landing-slider-dots" aria-label="Chọn trang">{slides.map((slide, index) => <button key={slide.tag} type="button" className={active === index ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Xem trang ${index + 1}`} aria-current={active === index ? 'true' : undefined} />)}</div><div className="landing-slider-arrows"><button type="button" onClick={() => move(-1)} aria-label="Trang trước">←</button><button type="button" onClick={() => move(1)} aria-label="Trang tiếp">→</button></div></div>
  </div>;
}
