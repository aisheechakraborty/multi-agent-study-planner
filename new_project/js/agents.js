/* ========================================
   AI Study Command Center — Agent Logic
   Planner | Tracker | Motivation | Doubt Solver
   ======================================== */

// ==========================================
// PLANNER AGENT
// ==========================================
class PlannerAgent {
  constructor() {
    this.name = 'Planner Agent';
  }

  generatePlan(examDate, subjects, dailyHours, weakSubjects) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exam = new Date(examDate);
    exam.setHours(0, 0, 0, 0);

    const totalDays = Math.max(1, Math.ceil((exam - today) / (1000 * 60 * 60 * 24)));
    const allSubjects = [...subjects];
    const weakSet = new Set(weakSubjects);

    // Calculate weights: weak subjects get 2x, normal get 1x
    const subjectWeights = allSubjects.map(s => ({
      name: s,
      weight: weakSet.has(s) ? 2 : 1,
      isWeak: weakSet.has(s)
    }));

    const totalWeight = subjectWeights.reduce((sum, s) => sum + s.weight, 0);

    // Time per unit weight per day
    const minutesPerDay = dailyHours * 60;

    // Generate plan
    const plan = [];
    const revisionInterval = 4; // revision every 4th day
    const lastRevisionDays = Math.min(2, Math.floor(totalDays * 0.15)); // last 10-15% for revision

    for (let i = 0; i < totalDays; i++) {
      const date = new Date(today.getTime() + i * 86400000);
      const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const isRevisionDay = ((i + 1) % revisionInterval === 0) || (i >= totalDays - lastRevisionDays);
      const isToday = i === 0;

      const dayPlan = {
        dayNum: i + 1,
        date: date,
        dateStr: dateStr,
        dayOfWeek: dayOfWeek,
        isRevision: isRevisionDay,
        isToday: isToday,
        isPast: false,
        tasks: []
      };

      if (isRevisionDay) {
        // Revision day: review all subjects or focus on weak ones
        const revisionSubjects = weakSubjects.length > 0 ? weakSubjects : allSubjects;
        const timePerSubject = Math.floor(minutesPerDay / revisionSubjects.length);

        revisionSubjects.forEach(sub => {
          dayPlan.tasks.push({
            id: `day${i + 1}-${sub}-rev`,
            subject: sub,
            type: 'revision',
            duration: timePerSubject,
            isWeak: weakSet.has(sub),
            status: 'pending' // pending, completed, missed
          });
        });
      } else {
        // Regular day: pick 2-4 subjects using round-robin with weight consideration
        const subjectsForDay = this._pickSubjectsForDay(subjectWeights, i, Math.min(allSubjects.length, dailyHours <= 3 ? 2 : dailyHours <= 6 ? 3 : 4));
        const totalDayWeight = subjectsForDay.reduce((sum, s) => sum + s.weight, 0);

        subjectsForDay.forEach(sub => {
          const proportion = sub.weight / totalDayWeight;
          const duration = Math.max(30, Math.round((proportion * minutesPerDay) / 15) * 15); // Round to 15 min blocks

          dayPlan.tasks.push({
            id: `day${i + 1}-${sub.name}`,
            subject: sub.name,
            type: 'study',
            duration: duration,
            isWeak: sub.isWeak,
            status: 'pending'
          });
        });
      }

      plan.push(dayPlan);
    }

    return plan;
  }

  _pickSubjectsForDay(subjectWeights, dayIndex, count) {
    // Weighted round-robin: rotate through subjects, but weak subjects appear more often
    const expanded = [];
    subjectWeights.forEach(s => {
      for (let i = 0; i < s.weight; i++) {
        expanded.push(s);
      }
    });

    const picked = [];
    const usedNames = new Set();

    for (let i = 0; i < count && picked.length < count; i++) {
      const idx = (dayIndex * count + i) % expanded.length;
      const sub = expanded[idx];
      if (!usedNames.has(sub.name)) {
        picked.push(sub);
        usedNames.add(sub.name);
      }
    }

    // If we didn't get enough, fill from remaining
    if (picked.length < count) {
      for (const s of subjectWeights) {
        if (!usedNames.has(s.name) && picked.length < count) {
          picked.push(s);
          usedNames.add(s.name);
        }
      }
    }

    return picked;
  }

  formatDuration(minutes) {
    if (minutes >= 60) {
      const hrs = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
    }
    return `${minutes}m`;
  }
}


// ==========================================
// TRACKER AGENT
// ==========================================
class TrackerAgent {
  constructor() {
    this.name = 'Tracker Agent';
  }

  getStats(plan) {
    let completed = 0, missed = 0, pending = 0, total = 0;

    plan.forEach(day => {
      day.tasks.forEach(task => {
        total++;
        if (task.status === 'completed') completed++;
        else if (task.status === 'missed') missed++;
        else pending++;
      });
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, missed, pending, total, completionRate };
  }

  getTodaysTasks(plan) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const day of plan) {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);
      if (dayDate.getTime() === today.getTime()) {
        return day;
      }
    }

    // If no exact match, return first day with pending tasks
    for (const day of plan) {
      if (day.tasks.some(t => t.status === 'pending')) {
        return day;
      }
    }

    return plan[0];
  }

  getUpcomingTasks(plan) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = [];

    for (const day of plan) {
      const dayDate = new Date(day.date);
      dayDate.setHours(0, 0, 0, 0);
      if (dayDate > today) {
        upcoming.push(day);
        if (upcoming.length >= 3) break;
      }
    }

    return upcoming;
  }

  reschedule(plan, dailyHours) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const minutesPerDay = dailyHours * 60;

    // Collect missed tasks
    const missedTasks = [];
    plan.forEach(day => {
      day.tasks.forEach(task => {
        if (task.status === 'missed') {
          missedTasks.push({ ...task, status: 'pending', type: 'rescheduled' });
        }
      });
    });

    if (missedTasks.length === 0) return plan;

    // Remove missed tasks from their original days
    plan.forEach(day => {
      day.tasks = day.tasks.filter(t => t.status !== 'missed');
    });

    // Find future days with available time
    let missedIdx = 0;
    for (let i = 0; i < plan.length && missedIdx < missedTasks.length; i++) {
      const dayDate = new Date(plan[i].date);
      dayDate.setHours(0, 0, 0, 0);
      if (dayDate < today) continue;

      const currentTotalMinutes = plan[i].tasks.reduce((sum, t) => sum + t.duration, 0);
      const availableMinutes = minutesPerDay - currentTotalMinutes;

      if (availableMinutes >= 30) {
        const task = missedTasks[missedIdx];
        const taskDuration = Math.min(task.duration, availableMinutes);
        task.duration = taskDuration;
        task.id = `day${plan[i].dayNum}-${task.subject}-resched`;
        plan[i].tasks.push(task);
        missedIdx++;
      }
    }

    return plan;
  }

  getSubjectStats(plan) {
    const stats = {};

    plan.forEach(day => {
      day.tasks.forEach(task => {
        if (!stats[task.subject]) {
          stats[task.subject] = { completed: 0, missed: 0, pending: 0, totalTime: 0, completedTime: 0 };
        }
        stats[task.subject].totalTime += task.duration;
        if (task.status === 'completed') {
          stats[task.subject].completed++;
          stats[task.subject].completedTime += task.duration;
        }
        else if (task.status === 'missed') stats[task.subject].missed++;
        else stats[task.subject].pending++;
      });
    });

    return stats;
  }

  getStrongestAndWeakest(plan) {
    const stats = this.getSubjectStats(plan);
    let strongest = '—', weakest = '—';
    let highRate = -1, lowRate = 101;

    for (const [subject, data] of Object.entries(stats)) {
      const total = data.completed + data.missed + data.pending;
      if (total === 0) continue;
      const rate = (data.completed / total) * 100;

      if (rate > highRate) { highRate = rate; strongest = subject; }
      if (rate < lowRate) { lowRate = rate; weakest = subject; }
    }

    return { strongest, weakest };
  }
}


// ==========================================
// MOTIVATION AGENT
// ==========================================
class MotivationAgent {
  constructor() {
    this.name = 'Motivation Agent';
    this.messages = {
      start: [
        "🚀 Your study plan is ready! Every expert was once a beginner. Let's start strong!",
        "📚 A journey of a thousand pages begins with a single chapter. You've got this!",
        "💪 Your plan is set. Consistency beats intensity — show up every day and watch the magic happen!",
        "🌟 The best time to start was yesterday. The next best time is now. Let's go!",
        "🎯 Goals without plans are just wishes. You've got both now — time to make it happen!"
      ],
      consistent: [
        "🔥 You're on fire! Keep this momentum going — consistency is your superpower!",
        "⭐ Outstanding work! Your dedication is the kind that turns average into excellent.",
        "🏆 Look at you crushing it! Every completed task is a step closer to acing that exam.",
        "💎 Diamonds are made under pressure, and you're handling it like a champ!",
        "🎉 Your consistency is inspiring! Past-you would be so proud of present-you.",
        "🚀 You're in the zone! This is what discipline looks like — keep it up!"
      ],
      behind: [
        "💪 Falling behind doesn't mean falling apart. Adjust, adapt, and keep moving forward!",
        "🌱 Growth isn't always linear. What matters is that you're still here and trying.",
        "☀️ Every morning is a fresh start. Yesterday's missed tasks don't define tomorrow's success.",
        "🤝 It's okay to struggle — that's where real learning happens. You've got this!",
        "🔄 The plan has been adjusted for you. Small steps still lead to big destinations.",
        "🌟 Don't count the days — make the days count. Start with just one task today."
      ],
      almostThere: [
        "🏁 The finish line is in sight! Push through — you're closer than you think!",
        "⚡ Final stretch! Channel all your energy into these last few days.",
        "🎯 So close! Remember why you started. That reason hasn't changed.",
        "🔥 The last mile is always the hardest — but also the most rewarding!",
        "💫 Almost there! Your future self will thank you for not giving up now."
      ]
    };
  }

  getMessage(stats, daysLeft, streak) {
    let category;

    if (daysLeft <= 3) {
      category = 'almostThere';
    } else if (stats.completionRate >= 70) {
      category = 'consistent';
    } else if (stats.completionRate < 40 && stats.total > 0) {
      category = 'behind';
    } else {
      category = 'start';
    }

    const pool = this.messages[category];
    const msg = pool[Math.floor(Math.random() * pool.length)];

    // Add streak bonus
    let streakBonus = '';
    if (streak >= 7) {
      streakBonus = `\n\n🔥 ${streak}-day streak! You're absolutely unstoppable!`;
    } else if (streak >= 3) {
      streakBonus = `\n\n🔥 ${streak}-day streak! Keep the fire burning!`;
    }

    return msg + streakBonus;
  }

  getStartMessage() {
    const pool = this.messages.start;
    return pool[Math.floor(Math.random() * pool.length)];
  }
}


// ==========================================
// DOUBT SOLVER AGENT
// ==========================================
class DoubtSolverAgent {
  constructor() {
    this.name = 'Doubt Solver Agent';
    this.knowledgeBase = this._buildKnowledgeBase();
  }

  solve(subject, question, mode) {
    const subjectLower = subject.toLowerCase();
    const questionLower = question.toLowerCase();

    // Try to find a matching topic
    let bestMatch = null;
    let bestScore = 0;

    for (const [key, entry] of Object.entries(this.knowledgeBase)) {
      const score = this._matchScore(questionLower, entry.keywords);
      const subjectMatch = entry.subjects.some(s => subjectLower.includes(s));

      if (subjectMatch && score > bestScore) {
        bestScore = score;
        bestMatch = entry;
      }
    }

    // If no subject-specific match, try general match
    if (!bestMatch || bestScore < 2) {
      for (const [key, entry] of Object.entries(this.knowledgeBase)) {
        const score = this._matchScore(questionLower, entry.keywords);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry;
        }
      }
    }

    if (bestMatch && bestScore >= 1) {
      return mode === 'exam' ? bestMatch.examFocused : bestMatch.simple;
    }

    // Generic response
    return this._genericResponse(subject, question, mode);
  }

  _matchScore(question, keywords) {
    let score = 0;
    for (const kw of keywords) {
      if (question.includes(kw.toLowerCase())) {
        score += kw.length > 5 ? 2 : 1;
      }
    }
    return score;
  }

  _genericResponse(subject, question, mode) {
    if (mode === 'exam') {
      return {
        title: `📝 Exam Tips: ${subject}`,
        sections: [
          {
            heading: '🎯 Exam Strategy',
            content: `For questions about "${question}" in ${subject}:`,
            points: [
              'Start by identifying the key concepts involved',
              'Break the problem into smaller, manageable parts',
              'Write down all relevant formulas or definitions first',
              'Show your work step by step — partial marks matter',
              'Double-check your final answer if time permits'
            ]
          },
          {
            heading: '📚 Study Approach',
            points: [
              `Review your ${subject} textbook chapter related to this topic`,
              'Practice 5-10 similar problems from past papers',
              'Create a quick-reference formula/concept sheet',
              'Teach this concept to someone else to test your understanding'
            ]
          }
        ]
      };
    }

    return {
      title: `💡 Understanding: ${subject}`,
      sections: [
        {
          heading: '🧠 How to Approach This',
          content: `Great question about ${subject}! Here's how to think about it:`,
          points: [
            'Start with the basics — make sure you understand the foundational concepts',
            'Look for patterns and connections to things you already know',
            'Try working through a simple example before tackling complex ones',
            'Don\'t hesitate to draw diagrams or visual aids',
            'Break complex concepts into smaller, digestible pieces'
          ]
        },
        {
          heading: '💡 Pro Tip',
          content: `The best way to truly understand a topic in ${subject} is to practice actively — don't just read, try to solve problems and explain concepts in your own words.`
        }
      ]
    };
  }

  _buildKnowledgeBase() {
    return {
      quadratic: {
        subjects: ['math', 'algebra', 'mathematics'],
        keywords: ['quadratic', 'quadratic formula', 'ax2', 'bx', 'roots', 'discriminant'],
        simple: {
          title: '💡 The Quadratic Formula',
          sections: [
            {
              heading: '📖 What Is It?',
              content: 'The quadratic formula helps you find the values of x that satisfy any equation of the form ax² + bx + c = 0.'
            },
            {
              heading: '📝 The Formula',
              content: 'x = (-b ± √(b² - 4ac)) / 2a',
              points: [
                'a, b, c are the coefficients from your equation',
                'The ± means you get TWO answers (two roots)',
                'The part under the square root (b² - 4ac) is called the discriminant'
              ]
            },
            {
              heading: '🔍 The Discriminant Tells You:',
              points: [
                'If b² - 4ac > 0 → Two different real roots',
                'If b² - 4ac = 0 → One repeated real root',
                'If b² - 4ac < 0 → No real roots (complex numbers)'
              ]
            },
            {
              heading: '✏️ Example',
              content: 'Solve: 2x² + 5x - 3 = 0\n→ a=2, b=5, c=-3\n→ x = (-5 ± √(25+24)) / 4\n→ x = (-5 ± 7) / 4\n→ x = 0.5 or x = -3'
            }
          ]
        },
        examFocused: {
          title: '🎯 Quadratic Formula — Exam Guide',
          sections: [
            {
              heading: '⚡ Quick Formula',
              content: 'x = (-b ± √(b² - 4ac)) / 2a'
            },
            {
              heading: '✅ Step-by-Step for Exams',
              points: [
                'Step 1: Write equation in standard form ax² + bx + c = 0',
                'Step 2: Identify a, b, c clearly',
                'Step 3: Calculate discriminant D = b² - 4ac',
                'Step 4: Substitute into formula',
                'Step 5: Simplify and find both roots',
                'Step 6: Verify by plugging roots back in'
              ]
            },
            {
              heading: '⚠️ Common Mistakes',
              points: [
                'Forgetting the negative sign before b',
                'Not writing equation in standard form first',
                'Arithmetic errors in discriminant calculation',
                'Forgetting there are TWO solutions (±)'
              ]
            }
          ]
        }
      },

      newton: {
        subjects: ['physics', 'mechanics', 'science'],
        keywords: ['newton', 'force', 'motion', 'f=ma', 'laws of motion', 'inertia', 'action reaction'],
        simple: {
          title: "💡 Newton's Laws of Motion",
          sections: [
            {
              heading: '1️⃣ First Law (Inertia)',
              content: 'An object stays at rest or keeps moving at constant speed unless a force acts on it.',
              points: [
                'Think: a book on a table stays still until you push it',
                'A ball rolling on ice keeps going because there\'s very little friction'
              ]
            },
            {
              heading: '2️⃣ Second Law (F = ma)',
              content: 'Force equals mass times acceleration. The heavier something is, the more force you need to move it.',
              points: [
                'F = ma (Force = Mass × Acceleration)',
                'Push a shopping cart vs. push a car — same idea!'
              ]
            },
            {
              heading: '3️⃣ Third Law (Action-Reaction)',
              content: 'Every action has an equal and opposite reaction.',
              points: [
                'You push the wall, the wall pushes you back',
                'Rocket pushes gas down, gas pushes rocket up'
              ]
            }
          ]
        },
        examFocused: {
          title: "🎯 Newton's Laws — Exam Guide",
          sections: [
            {
              heading: '⚡ Key Formulas',
              points: ['F = ma', 'W = mg (weight)', 'F₁₂ = -F₂₁ (Third Law)']
            },
            {
              heading: '✅ Problem-Solving Strategy',
              points: [
                'Draw a free body diagram (FBD) — this alone can earn marks',
                'List all forces acting on the object',
                'Choose a coordinate system (usually x-y)',
                'Apply ΣF = ma in each direction',
                'Solve the equations'
              ]
            },
            {
              heading: '⚠️ Common Mistakes',
              points: [
                'Forgetting friction or normal force in FBD',
                'Confusing mass and weight',
                'Not considering all forces in a system'
              ]
            }
          ]
        }
      },

      derivatives: {
        subjects: ['math', 'calculus', 'mathematics'],
        keywords: ['derivative', 'differentiation', 'rate of change', 'slope', 'dy/dx', 'tangent'],
        simple: {
          title: '💡 Derivatives (Differentiation)',
          sections: [
            {
              heading: '📖 What Is a Derivative?',
              content: 'A derivative tells you the rate of change — how fast something is changing at any given point. Think of it as the slope of a curve.'
            },
            {
              heading: '📝 Basic Rules',
              points: [
                'Power Rule: d/dx(xⁿ) = nxⁿ⁻¹',
                'Constant Rule: d/dx(c) = 0',
                'Sum Rule: d/dx(f+g) = f\' + g\'',
                'Product Rule: d/dx(fg) = f\'g + fg\'',
                'Chain Rule: d/dx(f(g(x))) = f\'(g(x)) · g\'(x)'
              ]
            },
            {
              heading: '✏️ Example',
              content: 'Find d/dx of 3x² + 2x + 5\n→ = 6x + 2 + 0\n→ = 6x + 2'
            }
          ]
        },
        examFocused: {
          title: '🎯 Derivatives — Exam Guide',
          sections: [
            {
              heading: '⚡ Must-Know Formulas',
              points: [
                'd/dx(xⁿ) = nxⁿ⁻¹',
                'd/dx(eˣ) = eˣ',
                'd/dx(ln x) = 1/x',
                'd/dx(sin x) = cos x',
                'd/dx(cos x) = -sin x'
              ]
            },
            {
              heading: '⚠️ Watch Out For',
              points: [
                'Always check if Chain Rule is needed (composite functions)',
                'Don\'t forget the constant multiplier',
                'Product and Quotient rules: practice identifying when to use each',
                'Show every step for maximum partial credit'
              ]
            }
          ]
        }
      },

      periodic: {
        subjects: ['chemistry', 'science', 'chem'],
        keywords: ['periodic table', 'elements', 'periods', 'groups', 'electron', 'atomic', 'valence'],
        simple: {
          title: '💡 The Periodic Table',
          sections: [
            {
              heading: '📖 What Is It?',
              content: 'The periodic table organizes all known elements by their atomic number (number of protons). Elements in the same column (group) share similar properties.'
            },
            {
              heading: '🔍 Key Concepts',
              points: [
                'Rows = Periods (energy levels of electrons)',
                'Columns = Groups (similar chemical behavior)',
                'Left side = Metals, Right side = Non-metals',
                'Atomic number increases left to right, top to bottom',
                'Elements in the same group have the same number of valence electrons'
              ]
            },
            {
              heading: '📝 Important Trends',
              points: [
                'Atomic radius: decreases across a period, increases down a group',
                'Electronegativity: increases across a period, decreases down a group',
                'Ionization energy: increases across a period, decreases down a group'
              ]
            }
          ]
        },
        examFocused: {
          title: '🎯 Periodic Table — Exam Guide',
          sections: [
            {
              heading: '⚡ Key Trends to Remember',
              points: [
                'Atomic size: → decreases, ↓ increases',
                'Ionization energy: → increases, ↓ decreases',
                'Electronegativity: → increases, ↓ decreases',
                'Metallic character: → decreases, ↓ increases'
              ]
            },
            {
              heading: '✅ Exam Tips',
              points: [
                'Memorize Group 1, 17, 18 properties — frequently tested',
                'Know the first 20 elements and their electron configurations',
                'Understand why trends occur (nuclear charge, shielding)',
                'Practice identifying element properties from position'
              ]
            }
          ]
        }
      },

      integration: {
        subjects: ['math', 'calculus', 'mathematics'],
        keywords: ['integral', 'integration', 'antiderivative', 'area under', 'definite', 'indefinite'],
        simple: {
          title: '💡 Integration',
          sections: [
            {
              heading: '📖 What Is Integration?',
              content: 'Integration is the reverse of differentiation. It finds the area under a curve or the original function from its derivative.'
            },
            {
              heading: '📝 Basic Rules',
              points: [
                'Power Rule: ∫xⁿ dx = xⁿ⁺¹/(n+1) + C',
                '∫eˣ dx = eˣ + C',
                '∫(1/x) dx = ln|x| + C',
                '∫sin x dx = -cos x + C',
                '∫cos x dx = sin x + C'
              ]
            },
            {
              heading: '💡 Remember',
              content: 'Always add "+ C" for indefinite integrals! C is the constant of integration.'
            }
          ]
        },
        examFocused: {
          title: '🎯 Integration — Exam Guide',
          sections: [
            {
              heading: '⚡ Techniques to Know',
              points: [
                'Direct integration (basic formulas)',
                'Integration by substitution (u-substitution)',
                'Integration by parts: ∫u dv = uv - ∫v du',
                'Partial fractions (for rational functions)'
              ]
            },
            {
              heading: '⚠️ Common Mistakes',
              points: [
                'Forgetting + C in indefinite integrals',
                'Wrong limits in definite integrals',
                'Not simplifying before integrating',
                'Choosing wrong u and dv in integration by parts'
              ]
            }
          ]
        }
      },

      cell: {
        subjects: ['biology', 'bio', 'science', 'life science'],
        keywords: ['cell', 'mitochondria', 'nucleus', 'organelle', 'membrane', 'cytoplasm', 'plant cell', 'animal cell'],
        simple: {
          title: '💡 Cell Biology',
          sections: [
            {
              heading: '📖 The Cell',
              content: 'Cells are the basic building blocks of all living things. Every organism is made of one or more cells.'
            },
            {
              heading: '🔍 Key Organelles',
              points: [
                'Nucleus: Control center, contains DNA',
                'Mitochondria: Powerhouse of the cell (produces energy/ATP)',
                'Cell Membrane: Controls what enters and exits',
                'Ribosomes: Makes proteins',
                'Endoplasmic Reticulum (ER): Transport system',
                'Golgi Apparatus: Packages and ships proteins'
              ]
            },
            {
              heading: '🌿 Plant vs Animal Cells',
              points: [
                'Plant cells have: cell wall, chloroplasts, large vacuole',
                'Animal cells have: smaller vacuoles, no cell wall, no chloroplasts',
                'Both have: nucleus, mitochondria, ribosomes, ER, Golgi'
              ]
            }
          ]
        },
        examFocused: {
          title: '🎯 Cell Biology — Exam Guide',
          sections: [
            {
              heading: '⚡ Must-Know Facts',
              points: [
                'Mitochondria = ATP production (cellular respiration)',
                'Chloroplasts = Photosynthesis (plants only)',
                'Nucleus = DNA storage and gene expression',
                'Cell membrane = Selectively permeable (phospholipid bilayer)'
              ]
            },
            {
              heading: '✅ Diagram Tips',
              points: [
                'Practice drawing and labeling cell diagrams',
                'Know the difference between prokaryotic and eukaryotic cells',
                'Understand cell membrane structure (fluid mosaic model)',
                'Be ready to compare plant and animal cells in a table'
              ]
            }
          ]
        }
      },

      gravity: {
        subjects: ['physics', 'science', 'mechanics'],
        keywords: ['gravity', 'gravitational', 'free fall', 'g=9.8', 'weight', 'acceleration due to gravity', 'projectile'],
        simple: {
          title: '💡 Gravity & Free Fall',
          sections: [
            {
              heading: '📖 What Is Gravity?',
              content: 'Gravity is the force that pulls objects toward each other. On Earth, it accelerates objects downward at approximately 9.8 m/s².'
            },
            {
              heading: '📝 Key Formulas',
              points: [
                'Weight: W = mg (mass × gravitational acceleration)',
                'Free fall distance: h = ½gt²',
                'Final velocity: v = gt',
                'g ≈ 9.8 m/s² (or ~10 m/s² for quick calculations)'
              ]
            },
            {
              heading: '💡 Key Insight',
              content: 'All objects fall at the same rate regardless of mass (ignoring air resistance). A feather and a bowling ball fall at the same speed in a vacuum!'
            }
          ]
        },
        examFocused: {
          title: '🎯 Gravity & Free Fall — Exam Guide',
          sections: [
            {
              heading: '⚡ Essential Formulas',
              points: [
                'F = GMm/r² (Universal gravitation)',
                'g = GM/R² (surface gravity)',
                'v² = u² + 2as (kinematics)',
                's = ut + ½at² (displacement)'
              ]
            },
            {
              heading: '⚠️ Watch Out For',
              points: [
                'Sign conventions: choose up or down as positive and be consistent',
                'At maximum height, velocity = 0 (not acceleration)',
                'g is always downward — don\'t change its direction mid-problem'
              ]
            }
          ]
        }
      },

      programming: {
        subjects: ['computer', 'programming', 'coding', 'cs', 'computer science', 'software'],
        keywords: ['loop', 'function', 'variable', 'array', 'algorithm', 'data structure', 'oop', 'class', 'object', 'recursion', 'sort', 'linked list'],
        simple: {
          title: '💡 Programming Fundamentals',
          sections: [
            {
              heading: '📖 Core Concepts',
              content: 'Programming is about giving instructions to a computer. You use variables to store data, loops to repeat actions, and functions to organize code.'
            },
            {
              heading: '🔍 Key Building Blocks',
              points: [
                'Variables: Store data (numbers, text, etc.)',
                'Conditionals: if/else statements make decisions',
                'Loops: for/while repeat actions',
                'Functions: Reusable blocks of code',
                'Arrays/Lists: Collections of related data',
                'Objects/Classes: Group data and behavior together (OOP)'
              ]
            },
            {
              heading: '💡 Problem-Solving Approach',
              points: [
                '1. Understand the problem completely',
                '2. Break it into smaller sub-problems',
                '3. Write pseudocode first',
                '4. Implement and test each part',
                '5. Debug and optimize'
              ]
            }
          ]
        },
        examFocused: {
          title: '🎯 Programming — Exam Guide',
          sections: [
            {
              heading: '⚡ Must-Know Topics',
              points: [
                'Time complexity: O(1), O(n), O(n²), O(log n)',
                'Sorting: Bubble, Selection, Merge, Quick Sort',
                'Data structures: Array, Stack, Queue, Linked List, Tree',
                'OOP: Inheritance, Polymorphism, Encapsulation, Abstraction'
              ]
            },
            {
              heading: '✅ Exam Tips',
              points: [
                'Always trace through code by hand before answering',
                'Watch for off-by-one errors in loops',
                'Understand recursion: base case + recursive case',
                'Practice writing code on paper — no IDE help in exams!'
              ]
            }
          ]
        }
      }
    };
  }
}

// Export globally
window.PlannerAgent = PlannerAgent;
window.TrackerAgent = TrackerAgent;
window.MotivationAgent = MotivationAgent;
window.DoubtSolverAgent = DoubtSolverAgent;
