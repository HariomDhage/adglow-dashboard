const BackgroundOrbs = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      <div
        className="absolute w-[600px] h-[600px] rounded-full animate-float opacity-[0.12]"
        style={{
          background: 'radial-gradient(circle, #FF6B6B 0%, transparent 70%)',
          top: '-10%',
          right: '-5%',
        }}
      />
      <div
        className="absolute w-[500px] h-[500px] rounded-full animate-float-delayed opacity-[0.10]"
        style={{
          background: 'radial-gradient(circle, #FF8E53 0%, transparent 70%)',
          bottom: '10%',
          left: '-8%',
        }}
      />
      <div
        className="absolute w-[400px] h-[400px] rounded-full animate-float-slow opacity-[0.08]"
        style={{
          background: 'radial-gradient(circle, #FFC857 0%, transparent 70%)',
          top: '40%',
          right: '20%',
        }}
      />
      <div
        className="absolute w-[350px] h-[350px] rounded-full animate-float-delayed opacity-[0.06]"
        style={{
          background: 'radial-gradient(circle, #6366F1 0%, transparent 70%)',
          bottom: '-5%',
          right: '40%',
        }}
      />
    </div>
  );
};

export default BackgroundOrbs;
