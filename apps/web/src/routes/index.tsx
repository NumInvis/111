import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/Button'
import { motion } from 'framer-motion'
import { Sparkles, BrainCircuit, MessageSquare, GitBranch } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="min-h-screen bg-bg-paper flex flex-col">
      <header className="border-b-3 border-border-primary bg-bg-card shadow-nb">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary border-3 border-border-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-text-primary" />
            </div>
            <h1 className="font-mono text-lg font-bold text-text-primary">变分无限</h1>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl"
        >
          <div className="mb-8">
            <div className="inline-block bg-primary border-3 border-border-primary shadow-nb-lg px-8 py-4 mb-4">
              <h1 className="font-mono text-5xl md:text-6xl font-black text-text-primary tracking-tight">
                变分无限
              </h1>
            </div>
            <p className="font-mono text-sm text-text-secondary tracking-widest uppercase">
              Variational Infinity
            </p>
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="text-lg text-text-primary font-medium mb-10 leading-relaxed"
          >
            AI 全量生成的数学玄幻世界
            <br />
            每一次推演都是独一无二的修行人生
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Link to="/world-gen">
              <Button size="lg" className="gap-2">
                <Sparkles className="w-5 h-5" />
                开天辟地
              </Button>
            </Link>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl w-full"
        >
          <FeatureCard
            icon={<BrainCircuit className="w-7 h-7" />}
            title="AI 共创世界"
            description="数学即力量。AI 生成世界规则、势力、地点、NPC、事件与结局，每次推演都不相同。"
            color="cyan"
          />
          <FeatureCard
            icon={<MessageSquare className="w-7 h-7" />}
            title="自由对话"
            description="与具备记忆、情绪和目标的 AI NPC 自由交流。他们会记住你，会恨你，也会帮助你。"
            color="primary"
          />
          <FeatureCard
            icon={<GitBranch className="w-7 h-7" />}
            title="人生推演"
            description="从低阶修行者开始，每年做出选择。属性成长、境界突破、人际关系——你的人生由你书写。"
            color="purple"
          />
        </motion.div>
      </main>

      <footer className="border-t-3 border-border-primary bg-bg-card py-4">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="font-mono text-xs text-text-secondary">
            AI 原生数学玄幻人生模拟器 · 纯文字游戏体验
          </p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
  color,
}: {
  icon: React.ReactNode
  title: string
  description: string
  color: 'cyan' | 'primary' | 'purple'
}) {
  const colorMap = {
    cyan: 'bg-accent-cyan',
    primary: 'bg-primary',
    purple: 'bg-accent-purple',
  }

  return (
    <div className="bg-bg-card border-3 border-border-primary shadow-nb p-5 nb-hover">
      <div className={`w-12 h-12 ${colorMap[color]} border-3 border-border-primary flex items-center justify-center mb-3`}>
        {icon}
      </div>
      <h3 className="font-mono text-base font-bold text-text-primary mb-2">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed">{description}</p>
    </div>
  )
}
