# 2026-10-28 Google Scholar 预印本补全核对

来源：[Google Scholar 个人主页（按年份排序）](https://scholar.google.com/citations?hl=en&user=QXU_QbMAAAAJ&view_op=list_works&sortby=pubdate)。读取 `pagesize=100` 后，页面显示 Articles 1–60，Show more 已禁用，覆盖当前全部 60 条记录。

交叉比对 Scholar 的 arXiv / TechRxiv 条目及未标注正式出版渠道的 LLM4Solver，共 16 个候选：新增 9 条，已有 6 条，另 1 条已按 ICML 2026 录用论文收录，不重复新增。保留主页原有 11 条预印本与技术报告，不在本次操作中删除或重新分类历史记录。

## 新增记录

| 论文 | 年份 | 书目核对来源 |
| --- | --- | --- |
| Certainty Is Not Just Correctness: Rethinking Token-Level Certainty in LLM Reasoning | 2026 | [arXiv:2610.00296](https://arxiv.org/abs/2610.00296) |
| FSAN: Flow State Attention Network for Aerodynamic Prediction | 2026 | [arXiv:2609.06660](https://arxiv.org/abs/2609.06660) |
| InSituMeasure: Probing Situated Measurement Grounding in Industrial Scenes with Multimodal Large Language Models | 2026 | [arXiv:2609.04014](https://arxiv.org/abs/2609.04014) |
| To Think or Not to Think: Allocating Reasoning Where It Helps | 2026 | [arXiv:2609.29664](https://arxiv.org/abs/2609.29664) |
| FPGAgent: An LLM-Assisted Framework for Autonomous HLS Code Generation and Verification in FPGA Environments | 2026 | [arXiv:2608.23630](https://arxiv.org/abs/2608.23630) |
| HIERA: Workload-Aware Planning Across Implementation Spaces for GPU Kernel Optimization | 2026 | [arXiv:2608.21157](https://arxiv.org/abs/2608.21157) |
| Advancing Symbolic Discovery on Unsupervised Data: A Pre-training Framework for Non-degenerate Implicit Equation Discovery | 2025 | [arXiv:2505.03130](https://arxiv.org/abs/2505.03130) |
| Machine Learning Insides OptVerse AI Solver: Design Principles and Applications | 2024 | [arXiv:2401.05960](https://arxiv.org/abs/2401.05960) |
| LLM4Solver: Large Language Model for Efficient Algorithm Design of Combinatorial Optimization Solver | 2024 | [Google Scholar 详情](https://scholar.google.com/citations?view_op=view_citation&hl=en&user=QXU_QbMAAAAJ&citation_for_view=QXU_QbMAAAAJ:maZDTaKrznsC) · [OpenReview 稿件](https://openreview.net/forum?id=XTxdDEFR6D) |

## 处理边界

- 8 篇 arXiv 条目的标题、完整作者顺序及年份来自原站 citation 元数据，不采用搜索摘要中的省略作者。
- LLM4Solver 的标题、7 位作者、2024 年和 OpenReview 链接来自 Scholar 书目详情。OpenReview 当前要求浏览器验证；此条仅列为公开稿件，不推断其已被会议录用，也不赋予 CCF 等级。
- 作者顺序保持源站顺序。2505.03130 的源站作者采用姓在前的写法，统一为主页既有的名在前格式；本人统一署名 Xijun Li。LLM4Solver 中的 HAO Jianye 统一书写为 Jianye Hao。
- OptVerse 报告原来仅出现在“软件与系统”栏目，未进入论文/预印本清单；本次补充正式书目，原软件链接保留。
- VLA 论文（arXiv:2604.24447）已有 ICML 2026 录用条目，未重复增加预印本。
- G2MILP、Promoting Generalization for Exact Solvers、PASCAL、Offline Reinforcement Learning with Adaptive Behavior Regularization、ICAPS 2021 benchmark 和 Learning to Branch 均已有预印本条目，未重复添加。
- 广泛作者搜索存在同名作者，未导入不在本 Scholar 资料中且无法确认归属的条目。

## 页面与统计

- 中文、英文完整档案：新增相同的 9 条书目，含完整作者、标题、年份及原文链接。
- 中文、英文首页：共用更新后的论文数据，“其他成果”和“全部”筛选可检索新增记录；预印本与技术报告 11 → 20。
- 已发表/录用论文仍为 40；CCF A/B/C 仍为 24/4/5。预印本不计入这些数量。
- news 内容、条数和近期四条排列均不变。
- 精确元数据快照保存在 [回归测试夹具](../tests/fixtures/preprints-2026-10-28.json)，仅用于核对与回归测试，不由浏览器加载；网站书目仍以 `content/archive-*.html` 为编辑入口。

