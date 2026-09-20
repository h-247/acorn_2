# Acorn: kế hoạch bản chạy local không dùng AI, chỉ dùng công nghệ miễn phí

Ngày khảo sát: 2026-09-19. Phạm vi: một trung tâm tiếng Anh, chạy trên máy Windows của người phát triển, không phụ thuộc tài khoản cloud, API trả phí hay mô hình AI. Đây là kế hoạch triển khai, chưa phải báo cáo hoàn thành sản phẩm.

## 1. Định nghĩa phạm vi

Giữ vòng nghiệp vụ: tài liệu -> câu hỏi -> bài kiểm tra -> giao bài -> bài làm -> chấm tự động theo đáp án hoặc chấm bởi giáo viên -> learning evidence -> learner state -> gợi ý theo quy tắc -> quyết định của giáo viên -> chọn/tạo bản thích nghi thủ công -> hoạt động tiếp theo. Mọi bước phải tồn tại trong PostgreSQL và có thể truy vết.

Giữ 19/20 màn hình trong `docs/ui/screen-inventory.md`. Loại màn A8 AI Content Review và hai route `/ai-review`, `/ai-review/[id]`. Giữ A7 Recommendation Workspace vì đặc tả cho phép gợi ý thuần quy tắc, không cần mô hình. Giữ biên tập/thích nghi tài liệu thủ công, câu hỏi Writing/Speaking và chấm bằng rubric giáo viên. Chỉ tự chấm các loại câu hỏi có đáp án xác định được.

Loại hoàn toàn: AI adapter/mock AI, API `/api/ai/*`, sinh tài liệu/câu hỏi/bài kiểm tra bằng AI, AI adaptation, AI explanation, AI evaluation, AI candidate review, AI provenance và các chỉ số AI. Không hiển thị mục `GENERATE` trong chiến lược đề xuất. Nếu không có tài liệu phù hợp, hiển thị `NO_MATCH` và cho giáo viên tạo thủ công; không giả lập AI. Trong bản này, `AUTO` có nghĩa chấm theo đáp án cố định, không phải AI. Dữ liệu cũ có `AI_PLUS_TEACHER` chỉ được xử lý qua migration rõ ràng nếu có dữ liệu thực; seed demo được dựng lại.

Ngoài phạm vi theo đặc tả hiện tại: LMS tổng quát, thanh toán, CRM, điểm danh, lịch học, lớp trực tuyến, chống gian lận nâng cao, đa tenant, cloud deployment và chứng minh tải lớn.

## 2. Kết quả khảo sát hiện trạng

| Mảng | Đã có | Khoảng trống để chạy local thật |
| --- | --- | --- |
| Monorepo | Next.js 14, React 18, Fastify 4, TypeScript, Zod contracts, UI components, các route chính | Nhiều route chỉ là giao diện demo; client dùng `any`, bỏ qua lỗi hoặc có nút rỗng. |
| Dữ liệu | Drizzle schema, seed mẫu, PostgreSQL trong Compose | `db.ts` dùng mảng trong bộ nhớ; schema không nối với API, chưa có migration, restart làm mất thay đổi. Script `db:seed` trỏ tới `seed.ts` không tồn tại. |
| Tệp | Compose khai báo MinIO và giao diện upload theo thiết kế | `storage.ts` thực tế dùng `Map`; chưa có API upload/download, metadata, quyền truy cập hoặc bucket provisioning. |
| Đăng nhập | Route login, thông tin user/role | Login không kiểm mật khẩu, trả user ID như token; request thiếu token được mặc định là giáo viên; web gắn cứng Bearer ID; trang sign-in chỉ chuyển route. |
| Học thuật | Course/class/enrollment/taxonomy đọc được từ seed | Chưa có nghiệp vụ quản trị user, course, class, enrollment, taxonomy; nhiều thống kê lớp là hằng số. |
| Tài liệu | Danh sách, chi tiết, tạo và adapt thủ công có bản demo | Thiếu sửa/version mới, archive, duyệt/publish, upload, metadata thực và truy vết sử dụng. Tạo tài liệu hiện tự gán APPROVED. |
| Câu hỏi/bài kiểm tra | Tạo câu hỏi, tạo assessment, publish, assign sơ bộ | Thiếu sửa, trạng thái READY/CLOSED, kiểm tra item/skill, khóa bản đã dùng; assign chưa kiểm assessment đã publish, chưa xử lý đầy đủ learnerIds. |
| Bài làm | Autosave, submit, chấm MCQ và chấm rubric bằng giáo viên | Chưa kiểm chủ sở hữu/trạng thái/idempotency; MCQ cộng cứng 25 điểm/câu; chấm lại sinh evidence trùng; điểm fallback 75 và evaluator `AI_PLUS_TEACHER` sai phạm vi. |
| Evidence/state | Có chuẩn hóa, recent-N và confidence sơ bộ | State tính khi đọc, nhiều phần profile/trend/focus là số mẫu; correction chưa duy trì lịch sử bản sửa và chưa invalidate/recompute state. |
| Gợi ý/metrics | Route recommendation/teacher decision và metrics | Gợi ý tạo từ dữ liệu mẫu cố định, có `GENERATE`; mở trang có thể sinh record; metrics có tỷ lệ và thời gian cứng, chưa phản ánh sự kiện thật. |
| Kiểm thử | `pnpm test`: 4 file, 9 test qua ngày khảo sát | Test dùng in-memory store; chưa có Postgres/S3, browser end-to-end, kiểm quyền giữa người dùng, restart, rollback và retry. |

Tài liệu `README.md`, `apps/api/README.md`, `docs/setup/local-development.md` và `MANIFEST.md` còn mô tả bootstrap chưa có ứng dụng dù source đã tồn tại. Cập nhật chúng sau khi hành vi thật được triển khai.

## 3. Stack local với chi phí phần mềm 0

| Thành phần | Quyết định | Chi phí phần mềm và điều kiện |
| --- | --- | --- |
| Runtime | Node.js LTS tương thích Next.js/Fastify hiện tại; pnpm theo lockfile | 0; cố định phiên bản qua `.nvmrc`/`packageManager`, không dùng dịch vụ trả phí. |
| Web/API | Giữ Next.js, Fastify, TypeScript, Zod, Drizzle, Vitest, lucide | 0; self-host trên localhost. Không nâng major chỉ để làm kế hoạch này. |
| CSDL | PostgreSQL 16 container và Drizzle migrations | 0; dữ liệu nằm trong volume local. |
| Object storage | Thay MinIO local bằng SeaweedFS S3 API, bản release được pin và kiểm thử với AWS SDK; giữ interface S3-compatible theo ADR-0003 | 0 với bản Apache-2.0. MinIO hiện có thể dùng để đối chiếu trong lúc chuyển, nhưng repo upstream đã archived và dùng AGPLv3 nên không chọn làm mặc định mới. |
| Container trên Windows | Podman Desktop + Podman machine/WSL2 + Compose | 0, mã nguồn mở. Docker Desktop đang cài có thể dùng nếu giấy phép của tổ chức đủ điều kiện miễn phí; không coi đây là điều kiện bắt buộc. |
| Xác thực | Ứng dụng tự quản user, hash mật khẩu bằng thư viện OSS, cookie session HttpOnly/SameSite | 0; không cần Auth0/Firebase/SMTP/SMS. Tạo user/reset mật khẩu bởi admin local. |
| Test | Vitest + test Postgres/S3 + Playwright OSS chạy local | 0; không yêu cầu dịch vụ cloud. |

Chi phí bản quyền/dịch vụ bắt buộc: 0. Chi phí máy, điện, dung lượng đĩa, Internet tải package/image và công triển khai vẫn tồn tại; kế hoạch không giả định chúng bằng 0. Không dùng free trial, PAYG, thẻ tín dụng hay free tier có thể hết hạn. Chưa chứng minh stack mới hoạt động cho đến khi hoàn tất gate ở mục 6.

## 4. Các giai đoạn triển khai

Mỗi giai đoạn là một lát dọc: UI -> API -> quyền -> nghiệp vụ -> PostgreSQL/object storage -> audit -> test. Chỉ sang giai đoạn tiếp theo khi tiêu chí ở cột cuối qua. Có thể chia PR nhỏ trong từng giai đoạn. Ước lượng sơ bộ cho một developer quen stack: 8-14 tuần làm việc; không phải cam kết thời hạn.

| Thứ tự | Công việc cụ thể | Điều kiện nghiệm thu |
| --- | --- | --- |
| P0. Chốt hợp đồng non-AI, 2-3 ngày | Cập nhật `docs/canonical/` và ADR liên quan: loại AI scope, giữ deterministic recommendation, thay storage local mặc định; tách `NO_MATCH` khỏi `GENERATE`; xóa navigation/API client AI, mô tả lại 19 màn, bỏ metric AI. Chốt taxonomy/loại câu hỏi pilot bằng cấu hình seed ban đầu, để mở theo câu hỏi ở `11-open-questions.md`. | Không còn route/nút/API gọi AI trong build non-AI; không còn lời hứa tự sinh nội dung. `pnpm test` vẫn qua. |
| P1. Dev environment và persistence, 1-2 tuần | Pin Node/pnpm/image; thêm Compose PostgreSQL + SeaweedFS và health checks, bucket init; Drizzle config + migrations có FK/unique/check/index; chuyển từng module từ `db.getStore()` sang repository/transaction PostgreSQL; seed idempotent, tách demo data khỏi migration; sửa `db:seed`, Makefile/PowerShell setup, `.env.example`, README. | `up -> migrate -> seed -> start`, reboot/restart, dữ liệu vừa tạo còn nguyên. Seed chạy hai lần không nhân đôi. Test API dùng Postgres thật; volume vẫn còn sau `down` thường. |
| P2. Identity, RBAC và học thuật, 1-1.5 tuần | Hash và verify mật khẩu; session cookie, `/me`, logout, guard frontend và CSRF/CORS phù hợp. Role ADMIN/MANAGER/TEACHER/STUDENT; quyền theo class/enrollment ở từng route, không tin learnerId từ client. Admin quản lý user, course, class, enrollment; taxonomy đọc và quản lý có ràng buộc cây. Dữ liệu mẫu có account demo chỉ trong dev seed, không hardcode trên trang. | Sai mật khẩu/missing token trả 401; student không đọc/chấm bài người khác; teacher không đọc lớp ngoài scope; admin tạo lớp/enroll và teacher/student nhìn đúng dữ liệu. |
| P3. Material repository, 1-1.5 tuần | Tạo/sửa metadata, tìm/filter/sort/page, draft -> review/approved/active -> archive; material version và source lineage; adapt thủ công tạo material mới, so sánh version; upload/download tệp có size/type limit, private object, metadata DB, rollback/retry khi upload hỏng; link tệp qua API có kiểm quyền. | Tạo/upload/tìm/adapt/archive rồi restart vẫn đọc đúng; source không bị sửa; người ngoài scope không tải được; không có object public. |
| P4. Question, assessment và giao bài, 1-1.5 tuần | CRUD câu hỏi MCQ/short answer/writing/speaking với đáp án/rubric và weight theo skill; validate taxonomy/điểm; build assessment, edit khi draft, READY/PUBLISHED/CLOSED, preview; assign class hoặc nhiều learner đúng scope, due date, chống giao trùng theo chính sách; snapshot hoặc khóa nội dung đã dùng. | Một assessment publish được giao cho lớp, mỗi learner nhận đúng một attempt; không assign draft/closed; sửa câu hỏi đã dùng không làm đổi lịch sử bài làm. |
| P5. Student player, chấm và evidence, 1.5-2 tuần | Student home/assessment list/player lấy assignment thật; autosave, resume, submit idempotent. MCQ chấm theo points/answer key; short answer chỉ tự chấm nếu đáp án xác định rõ, còn lại hàng chờ teacher; Writing/Speaking do teacher chấm rubric, lưu audio qua S3. Transaction lưu response -> submit/evaluate -> evidence với unique source key, audit. | Hai lần submit/evaluate không tăng evidence; sau restart tiếp tục attempt đúng; bài chấm tay và tự chấm đều tạo điểm `[0,1]`, link tới question/submission/skill; invalid state/forbidden action bị chặn. |
| P6. Learner state, evidence explorer và gợi ý, 1-1.5 tuần | Tính state từ evidence thật theo recent-N và weight, `NO_DATA` là null; trend từ mốc thời gian thực; correction giữ old/new/actor/reason và recompute. Rule engine chọn skill đủ evidence, áp course/teacher constraints, tìm tài liệu approved theo `REUSE -> ADAPT`; nếu rỗng `NO_MATCH` + lối tạo thủ công. Snapshot state/evidence basis, stale khi evidence đổi; accept/modify/reject chỉ do teacher có quyền; quyết định không tự assign. | Evidence sửa làm state/rec cập nhật hoặc đánh dấu stale; profile không có số mẫu; gợi ý giải thích được từ evidence và tài liệu; chọn vật liệu và tạo hoạt động kế tiếp qua hành động riêng. |
| P7. Trang tác nghiệp, số liệu và polish, 1-1.5 tuần | Nối teacher home, class workspace, learner directory/profile, submission inbox/review, material/assessment screens với API thật; loading/empty/error/retry, điều hướng và quyền. Audit event có actor/route/entity; metrics reuse, adaptation, submission, recommendation decision và thời gian thao tác từ sự kiện thực, mẫu số định nghĩa rõ; xóa số liệu placeholder. | 19 màn trong scope đi lại được theo vai trò; mọi nút hiển thị đều có kết quả; metrics đối chiếu được với dữ liệu nguồn; không lộ bài làm cá nhân qua dashboard. |
| P8. Gate local và tài liệu vận hành, 3-5 ngày | Unit, integration DB/S3, authorization matrix, retry/restart, Playwright teacher/student; build, lint/typecheck, smoke 3 service; backup/restore Postgres và object volume; tài liệu setup Windows, lỗi thường gặp, reset seed, file dữ liệu mẫu. | Người khác clone mới chạy theo README và hoàn thành kịch bản mục 6; `git status` sạch sau setup nếu không sửa code; kết quả test/gate được ghi kèm phiên bản chạy thực tế. |

P1 là ưu tiên số 1: triển khai thêm giao diện trước khi có persistence và auth thật sẽ chỉ kéo dài demo. P2 và P3 có thể chia việc song song sau khi migration/repository contract của P1 ổn định. Với P4/P5, chốt rubric và assessment types theo dữ liệu trung tâm trước khi tuyên bố hoàn tất Writing/Speaking.

## 5. Hợp đồng dữ liệu và bảo mật cần siết

- Thêm constraint/unique cho `(class_id, learner_id)` enrollment, `(assessment_id, question_id)` assessment item, `(submission_id, question_id)` response, `(submission_id, question_id, skill_id, evidence_type)` evidence hoặc khóa idempotency tương đương. Ràng buộc score `[0,1]`, weight dương, points dương, due date hợp lệ; giữ foreign key và index cho learner/class/status/date.
- Chuẩn hóa source-of-truth: submission/evidence/decision là dữ liệu gốc; learner state, recommendation và metrics được dựng lại từ gốc. Transaction và unique key bảo vệ submit/evaluate retry. Khi correction xảy ra, không sửa lịch sử âm thầm; ghi bản sửa/audit và recompute.
- Thiết kế endpoint admin CRUD cho course/class/enrollment/user; material update/review/archive/file; question update/archive; assessment edit/ready/publish/close/assign; submission attempt/resume; learner state recompute và recommendation decision. Dùng Zod request/response contract, pagination/filter, mã lỗi ổn định và OpenAPI. Không dùng `any` ở boundary mới.
- Kiểm quyền trên API cho từng tài nguyên: admin/manager theo trung tâm, teacher theo lớp được giao, student theo enrollment và ownership. Chặn việc đọc toàn bộ `/users`, `/audit/events`, `/evidence`, `/submissions` cho role không đủ quyền. Tệp private có MIME/size limits và signed URL ngắn hạn hoặc streaming qua API.
- Không lưu mật khẩu plaintext/token vào log. Session cookie bảo vệ HTTP-only/SameSite; secret chỉ nằm trong `.env` local, không commit. Demo account chỉ xuất hiện trong hướng dẫn setup dev. CORS không mở `origin: true` cho mọi nguồn khi dùng cookie.

## 6. Gate nghiệm thu cuối cùng trên máy local

1. Từ clone sạch: cài Node/pnpm, Podman Desktop + WSL2/Compose, chạy lệnh setup được tài liệu hóa; không cần tài khoản ngoài hoặc thẻ. PostgreSQL/S3 health check xanh, migration + seed chạy lại được, web tại `http://localhost:3000`, API tại `http://localhost:4000/health`.
2. Admin tạo course, class, teacher, hai student và enrollment. Teacher chỉ thấy lớp mình; student chỉ thấy bài mình. Thử truy cập chéo qua URL/API phải bị từ chối.
3. Teacher tạo tài liệu có tệp, metadata và nguồn; adapt thủ công thành variant, so sánh version, tìm bằng filter, archive bản cũ. Restart toàn stack, nội dung và tệp vẫn còn, lineage còn nguyên.
4. Teacher tạo câu hỏi skill-mapped, assessment, publish rồi giao cho class. Student A autosave rồi restart trình duyệt, hoàn thành; student B chưa nộp không bị chấm. Teacher chấm rubric phần viết/nói; MCQ chấm theo đúng điểm cấu hình.
5. Lặp submit/evaluate sau timeout giả lập: đúng một bộ response/evidence. Evidence explorer chỉ ra câu hỏi, assessment, material và người chấm. Sửa evidence: audit old/new có đủ, state được tính lại; học viên không có dữ liệu hiển thị `NO_DATA`.
6. Tạo gợi ý thuần quy tắc từ state thật; teacher accept/modify/reject, có rationale và source; không có AI request. Hành động tạo/giao hoạt động tiếp theo là bước riêng. Metrics khớp số record thật và không chứa chỉ số AI.
7. `pnpm test`, build, lint/typecheck và Playwright luồng teacher/student đều qua; backup/restore được kiểm bằng dữ liệu sau khôi phục. Dừng và khởi động lại các service không xóa dữ liệu.

## 7. Quyết định cần xác nhận trong quá trình làm

Để bản local có thể hoàn thiện mà không chờ thiết kế học thuật hoàn hảo, dùng seed taxonomy CEFR/IELTS hiện tại như dữ liệu demo có version. Trước pilot thật, giáo viên/academic manager cần duyệt: taxonomy v1; loại câu hỏi và rubric Writing/Speaking; cách tính reuse, prep time; ngưỡng recommendation; nguồn và bản quyền tài liệu. Những giá trị này là giả định cấu hình, không được trình bày như kết luận sư phạm.

## Nguồn kiểm chứng chi phí và khả năng self-host

- [PostgreSQL license](https://www.postgresql.org/about/licence/): miễn phí, kể cả sử dụng thương mại.
- [Podman Desktop source/license](https://github.com/podman-desktop/podman-desktop) và [Windows install](https://podman-desktop.io/docs/installation/windows-install): Apache-2.0, chạy bằng WSL2/Podman machine trên Windows.
- [Docker Desktop license](https://docs.docker.com/subscription-billing/desktop-license/): miễn phí cho cá nhân/giáo dục và doanh nghiệp nhỏ đủ cả hai điều kiện dưới 250 nhân viên, doanh thu dưới 10 triệu USD; trường hợp khác có thể cần gói trả phí.
- [SeaweedFS](https://github.com/seaweedfs/seaweedfs): Apache-2.0, S3 API và `weed mini` chạy local; pin image/release sau khi integration test.
- [MinIO repository](https://github.com/minio/minio): upstream archived, bản community AGPLv3; lý do chọn giải pháp S3-compatible khác cho mặc định local.
- [Next.js self-hosting](https://nextjs.org/docs/app/guides/self-hosting): chạy trên Node server local; không yêu cầu nền tảng hosting trả phí.
