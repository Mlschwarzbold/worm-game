pipeline {
    agent any

    environment {
        IMAGE_NAME = 'worm-game'
        CONTAINER_NAME = 'worm-game'
        HOST_PORT = '80'
    }

    stages {
        stage('Build image') {
            steps {
                sh 'docker build --tag "$IMAGE_NAME:$BUILD_NUMBER" --tag "$IMAGE_NAME:latest" .'
            }
        }

        stage('Deploy container') {
            steps {
                sh '''
                    docker rm --force "$CONTAINER_NAME" 2>/dev/null || true
                    docker run --detach \
                        --name "$CONTAINER_NAME" \
                        --publish "$HOST_PORT:80" \
                        "$IMAGE_NAME:$BUILD_NUMBER"
                '''
            }
        }
    }
}
