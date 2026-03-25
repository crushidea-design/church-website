import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="bg-wood-100 min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm font-medium text-wood-600 hover:text-wood-900 mb-8 transition"
        >
          <ArrowLeft size={16} className="mr-2" />
          돌아가기
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-wood-200 p-8 md:p-12">
          <h1 className="text-3xl font-serif font-bold text-wood-900 mb-8">개인정보처리방침</h1>
          
          <div className="prose prose-stone max-w-none text-wood-700 leading-relaxed space-y-6">
            <section>
              <h2 className="text-xl font-bold text-wood-900 mb-3">1. 개인정보의 처리 목적</h2>
              <p>
                '함께 지어져가는 교회'(이하 '교회')는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>홈페이지 회원 가입 및 관리: 회원 가입 의사 확인, 회원제 서비스 제공에 따른 본인 식별·인증, 회원자격 유지·관리, 서비스 부정이용 방지 등</li>
                <li>서비스 제공: 게시판 이용, 문의 사항 응대, 교회 소식 전달 등</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-wood-900 mb-3">2. 처리하는 개인정보 항목</h2>
              <p>교회는 서비스 제공을 위해 다음과 같은 개인정보 항목을 처리하고 있습니다.</p>
              <ul className="list-disc pl-5 space-y-2">
                <li>필수항목: 이름(닉네임), 이메일 주소, 구글 계정 정보(소셜 로그인 시)</li>
                <li>선택항목: 문의 시 제공하는 연락처 등</li>
                <li>인터넷 서비스 이용 과정에서 자동으로 생성되어 수집될 수 있는 항목: IP주소, 쿠키, 서비스 이용 기록, 방문 기록 등</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-wood-900 mb-3">3. 개인정보의 처리 및 보유 기간</h2>
              <p>
                교회는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>홈페이지 회원 가입 및 관리: 홈페이지 탈퇴 시까지</li>
                <li>다만, 관계 법령 위반에 따른 수사·조사 등이 진행 중인 경우에는 해당 수사·조사 종료 시까지</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-wood-900 mb-3">4. 정보주체의 권리·의무 및 행사방법</h2>
              <p>
                정보주체는 교회에 대해 언제든지 개인정보 열람·정정·삭제·처리정지 요구 등의 권리를 행사할 수 있습니다. 권리 행사는 서면, 전자우편 등을 통하여 하실 수 있으며 교회는 이에 대해 지체 없이 조치하겠습니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-wood-900 mb-3">5. 개인정보의 파기</h2>
              <p>
                교회는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체 없이 해당 개인정보를 파기합니다. 전자적 파일 형태의 정보는 기록을 재생할 수 없는 기술적 방법을 사용합니다.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-wood-900 mb-3">6. 개인정보의 안전성 확보 조치</h2>
              <p>
                교회는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>관리적 조치: 내부관리계획 수립 및 시행, 정기적 직원 교육 등</li>
                <li>기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 고유식별정보 등의 암호화, 보안프로그램 설치 등</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-wood-900 mb-3">7. 개인정보 보호책임자</h2>
              <p>
                교회는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>개인정보 보호책임자: 관리자</li>
                <li>연락처: crushidea@gmail.com</li>
              </ul>
            </section>

            <section className="pt-8 border-t border-wood-100 text-sm text-wood-500">
              <p>공고일자: 2024년 3월 25일</p>
              <p>시행일자: 2024년 3월 25일</p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
