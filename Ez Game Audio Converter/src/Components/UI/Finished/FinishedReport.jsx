const FailedFiles = ({ files }) => (
    <div>
        <h2>Failed Files:</h2>
        <ul>
            {files.map((file, index) => (
                <li key={index}>{file}</li>
            ))}
        </ul>
    </div>
);

const CompletedFiles = ({ files }) => (
    <div>
        <h2>Completed Files:</h2>
        <ul>
            {files.map((file, index) => (
                <li key={index}>{file}</li>
            ))}
        </ul>
    </div>
);

const FinishedReport = () => {
    const failedFiles = ['file1.txt', 'file2.txt', 'file3.txt'];
    const completedFiles = ['file4.txt', 'file5.txt', 'file6.txt'];

    return (
        <div>
            <FailedFiles files={failedFiles} />
            <CompletedFiles files={completedFiles} />
        </div>
    );
};

export default FinishedReport;
