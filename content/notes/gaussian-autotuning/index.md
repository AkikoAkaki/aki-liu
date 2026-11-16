---
title: "Gaussian Autotuning 研究全流程"
date: 2026-11-09
tags: ["mlsys"]
draft: false
---

## 研究骨架

1. **研究问题**：我想要通过去掉一个 search dimension，来看看能不能让 autotuning 用更少的 tuning 成本找到相同或更好质量的 config。
	 - 在这个 project setting 中，我想要通过去掉一个 Gaussian 1024x1024 的 `in_cache_prv`，来看看能不能让 OpenTuner 在 RTX 4060 laptop 上用更少的 tuning 成本找到相同或更好质量的 Gaussian config。
	 - 研究结论也仅适用于这个 project setting。
2. **No-op**
	- **动机**：早期发现一个代码问题：改 cache 参数并不会改变 kernel，这几个参数其实是无效的。把它们去掉之后，tuning 变快了。于是我想用一个受控的实验确认，删掉无用参数是不是真的有用。
	- **做了什么**：人为地添加 K 个不改变 kernel 的参数。tuner 会搜它们，但运行前会把它们删掉。不同 K 都用同样的 40 个 config 预算，比较最终找到的 config 有多快。
	- **结果**：K 越大，最终 config 总体越慢。K=0 时是 0.0429 ms，K=5 时是 0.0655 ms。
	- **原因**：预算浪费在重复的 kernel 上，真正试到的不同 kernel 变少了。
	- **结论**：删掉没用的参数确实有用。
3. **Global fixing**
	- **动机**：由于先前发现删掉没用的参数确实有用，所以我在想能不能把它扩展为 “把对程序影响比较小的参数从 search space 中去掉，也可以改善 tuning 成本”。
	- **做了什么**：我随机抽了 8 个 valid layout，测了每个 cache 开关翻转前后的快慢差别，选出 3 个 cache 开关里影响最小的 `in_cache_prv`。之后，我在 tuning 开始前把它固定成 0 或 1，和不固定的搜索用同样的 2000 次 proposal 进行比较。
	- **结果**：固定成 1 之后，6 个 seed 里有 5 个比不固定慢超过 10%。
	- **原因**：固定后，搜索没有访问到空间里好的 config。固定和没固定的搜索会从某一步开始分叉，之后提出的 layout 就不一样了。
4. **Conditional**
	- **动机**：既然没有一个 cache 值对所有 layout 都好，那可以考虑根据不同的 layout 来在运行前决定 cache 值。
	- **做了什么**：设计了一个 policy 来覆盖这个参数：对每个候选，按它的 layout 算数据复用程度。复用低就关 cache；复用高、检查后没有 spill，就开 cache；其他情况（复用度不高不低，以及复用高又有 spill 的）留给 tuner 自己选。在这个实验中，tuner 仍然在搜这个参数，policy 只是覆盖它的值，因为有些情况下，参数依然要留给 tuner 自己选。并且复用高时除了 statically 用公式算，还可能需要编译一次做 PTX 检查。
	- **结果**：同样实际运行 200 次，质量比这正常情况略微好一点，总时间反而多了 4.6%。
	- **原因**：执行省了 14 秒、PTX 却要额外多花 42 秒。
5. **Oracle**
	- **动机**：Conditional 失败有两种情况，一种是 policy 还不够好，还需要继续优化 policy；另一种情况是去掉一个 search dimension 这套路本身就不是一个很好的想法，所以无论 policy 有多好也无法节省 tuning 成本。
	- **做了什么**：我想要测试整个 idea 的上限。我假设有一个完美的 policy 存在，每一次都能直接选到更快的 `in_cache_prv` 值（我的做法是，每有一个 valid proposal，我都把带有两个不同的 `in_cache_prv` 值的 config 实际跑一遍并选时间更短的那个。如果两个时间的 95% CI 重叠，就打开 cache，因为复用高时，开 cache 多数情况下更好，且若 CI 重叠，那它们的差别和噪声比起来已经很小了，影响不大。选值的那次测量不计入预算，相当于这个 policy 几乎是完美的，不消耗任何成本就能选到让最后的 kernel 更快的 `in_cache_prv` 值。）预算是 200 次 valid evaluation。
	- **结果**：9 对里 Oracle 更快 4 对、更慢 5 对，中位数 ratio 1.0475，表明 Oracle 没有稳定收益
	- **原因**：见研究结论
6. **研究结论**：
	1. OpenTuner 根据 GPU 给出的 feedback（返回的 running time），来决定怎么提出下一个 proposal。
	2. Remove 一个 search dimension 之后（Conditional 是部分去掉），tuner 会受到不同的 feedback，所以会从某一步开始分叉，之后提出的 layout 就不一样了。这不是在原来的搜索上做减法，而是换了一条全新的搜索路线。
	3. 在 Oracle 里，新路线上，每个被 propose 的 layout 的 cache 值都是两个值里面更好的一个，但问题是无法保证它 propose 的 layout 会是更好的 layout。
	4. 我的推断是，预算有限时，最终结果主要取决于有没有试到好的 layout。cache 选得好带来的那点提升，抵不过换路线带来的不确定。No-op 删掉的维度不改变 kernel，搜它只会把预算花在重复的 kernel 上，所以删掉它有稳定的收益，而 `in_cache_prv` 会影响 kernel 的时间从而改变 tuner 收到的反馈。


## Autotuner 的基本循环

Tuner（预算：N 次 evaluation）把 proposal 变成 config 交给 GPU；GPU 运行 kernel、测出 runtime 后返回；Tuner 根据 runtime 提出下一个 proposal，如此循环。

在这个 project 中，tuner 是 OpenTuner，kernel 是 Gaussian (image filtering)。
- 每个输出像素等于周围 5×5 个输入像素的加权和，用 OpenCL 写，文件是 `gaussian_static_1.cl`，输入是 1024×1024，跑在 GPU 上)

**Proposal 变成 config**：
1. `run()` 拿到 proposal 后用每个参数的取值表把下标换成真实值。只有一个取值的参数直接填进去，最后拼出完整的 config
2. `validate_config` 进行合法性检查：
	1. work-item 的大小不能超过 GPU 的上限
	2. `WI_1 × WI_2` 不能超过一个 work-group 的线程上限
	3. `GLB × WG × LCL × WI × PRV` 必须正好等于 1024，行和列两个维度都要
	4. 两个维度必须映射到 OpenCL 的不同维度上
3. 不合法的话，给 Tuner 返回 `1e9` ms。OpenTuner 本身不知道它是不合法，但它肯定不会是最快的。虽然 Tuner 不知道，但会在 `evaluations.jsonl` 记录中被记录在 `valid` 字段中
4. 合法的 config 会写成 JSON，类似

```json
{
	"glb_1": 1,  "wg_1": 4,   "lcl_1": 1, "wi_1": 16, "prv_1": 16,
	"glb_2": 4,  "wg_2": 128, "lcl_2": 1, "wi_2": 1,  "prv_2": 2,
	"in_cache_lcl": 0, "in_cache_prv": 0, "out_cache_prv": 0,
	"input_size_1": 1024, "input_size_2": 1024,
	"wg_1_ocl_dim": 1, …（其余固定参数）
}
```

**GPU 执行和测量**：
1. Python 启动 `gaussian.exe` 读入 JSON，初始化 OpenCL，把参数拼成 `-DGLB_1=1 -DWG_1=4 …` 这样的编译宏
2. 把这串宏用 OpenCL 编译 `gaussian_static_1.cl`
3. 跑一次 kernel
4. OpenCL 记下 kernel 的 `END` 和 `START`，`END - START` 计算时间。计算出的是 kernel 在 GPU 上真正执行时间，不包含启动开销，大约占启动总时间的 0.003%
5. 把结果读回 CPU，和 CPU 算的参考结果逐个比对，然后打印 `Device kernel execution time: 0.0356 ms`
6. Python 用正则从输出里读出这个数字，重复，算出 median/mean

从 OpenTuner 的角度看，一次 proposal 和它的反馈长这样：

```
送出: {idx.glb_1: 0, idx.wg_1: 2, idx.lcl_1: 0, idx.wi_1: 4, idx.prv_1: 4,
       idx.glb_2: 2, idx.wg_2: 7, …, idx.in_cache_prv: 0}
收到: 0.0356
```

**Tuner 得到反馈后**：
1. `run()` 返回 `Result(time=…)`
2. OpenTuner 把 time 和对应的 config 存进 `opentuner.db`
	- `opentuner.db` 是一个 SQLite 数据库文件，记录了全部的 config 和它的 time
	- 单独记下“目前最快”的结果。有新结果的时候和目前最快的比，记录更快的那个
	- 搜索结束时，把最快的 config 交给 `save_final_config()`，最后写进 `final_config.json`
3. 下一个 proposal 由搜索算法生成，用的是 OpenTuner 的默认搜索策略，也就是 AUC Bandit。AUC Bandit 根据历史搜索表现，来调度一些子算法来生成 proposal
	- 这是默认的通用策略，只看得到下标和时间。它们擅长在已经找到的好 config 附近继续改进

---

## 搜索空间参数

**分工参数**
- `GLB`：整个任务（计算输出图像）先切成多少个大段，每个 worker 组每段都做一块
- `WG`：每个大段分给多少个 worker 组
- `LCL`：每个大段里每个 worker 组做几轮（一次 LCL loop）
- `WI`：每个 worker 组里有几个 worker
- `PRV`：每轮里每个 worker 负责几个格子（输出图像的一个坐标）

注意：
- WG 和 WI 在GPU 上并行
- GLB, LCL, PRV 是一个 worker 自己按顺序跑的循环

**Cache 开关**
- `IN_CACHE_LCL`：是否把 input 暂存在同组 worker 共享的空间里，同组 worker 计算时可以使用这份数据。
- `IN_CACHE_PRV`：是否把 input 暂存在单个 worker 自己的空间里，这个 worker 计算多个附近的输出时可以使用这份数据。
- `OUT_CACHE_PRV`：是否把 output 暂存在单个 worker 自己的空间里，再写入输出图像。

---

## 每个实验的测量方式

- **No-op**：
    - 搜索时：warm up 2 次，正式测 5 次，取 median，返回给 tuner。
    - 最终结果：直接用搜索里最快的那个 median。
- **Global Fixing**：
    - 搜索时：warm up 2 次，正式测 5 次，取 median，返回给 tuner。
    - 最终结果：搜索里最快的 config 再单独测 2 + 20 次，取 median。
- **Conditional**：
    - 搜索前：tuner 提出 config 后，policy 先看复用分数，决定 `in_cache_prv` 用哪个值。
        - 复用低（≤ 1）：改成 0。
        - 复用中间：保留 tuner 提的值。
        - 复用高（≥ 4）：编译检查 PTX 有没有 spill。没有就改成 1；有 spill 或检查失败，保留 tuner 提的值。
    - 搜索时：实际跑的那个 config warm up 1 次，正式测 5 次，取 median，返回给 tuner。
    - 最终结果：搜索里最快的前 5 个 config 各再测 2 + 20 次，取 median，选最快的。
    - 对照组 Full 不经过 policy，直接跑 tuner 提的 config，测法相同。
- **Oracle**：
    - 搜索时：tuner 提出 config 后，`in_cache_prv = 0` 和 `= 1` 两个版本都测。两个版本交替跑：每轮里先测哪个轮流换。warm up 2 轮，正式测 20 轮。每个版本算 mean 和 95% CI。
    - 选值：
        - 一个版本跑失败，就选另一个。
        - 两个 CI 不重叠，选 mean 小的。
        - 两个 CI 重叠，选 1。
    - 选中版本的 mean 返回给 tuner。
    - 对照组 Full 只测 tuner 提的那一个版本，2 + 20 次取 mean。
    - 最终结果：最后的 config 再测 2 + 20 次，取 mean。